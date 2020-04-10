// Creating a bot to manage playing Praxis Arcanum RPG
// Basic functionality only: one game admin says !new game, defaulting them to GM, and then can !add @player so they each get a player deck.
//     Player decks have cards 1-3 of each suit, GM has 1-5. Player decks track exp and auto-add new cards, can add Praxes manually when cards are played.
//     Games can be saved by the admin with a !save command, and reloaded later (if the bot goes down) with !load. It automatically pulls the game where you are admin on the server.
//     Every player can view their !deck, !hand, !discard, !xp, !loss, and !reserve at any time.


// TO DO SOME OTHER DAY:
// a !help command would be super handy
// Swapping cards will get messy, since they need to have an owner?
// undo?? or ways to force cards to move locations
// Compare GM check with played card from a player
// make sure reshuffle is losing one highest one lowest
// walk through session zero to assign GM cards
// keep a separate doc that remembers the last open game - on ready, checks if game is saved in the guild? y: loads, n: makes 'none' game and saves it to memory. Updates on !new, !close, !load
// crucibles
// jokers??
// way to force cards to different locations

// Force
// typo in reshuffle
// add cards to GM deck
// draw same card in check
// one game across all servers


// Requires and setup
require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const token = process.env.DISCORD_BOT_TOKEN || '';
const PREFIX ='!';
const fs = require('fs');
let cardsinhand = [];
let cardsindiscard = [];
let embed = new Discord.MessageEmbed();
var mygame;
let waiting = {
    onReply: false,
    user: 'none'
}



// Creating a new collection of commands, in the appropriate folder
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles){
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// Creating a file of saved games
client.savedgames = require('./savedgames.json');


// Define essential classes: Cards, Decks, Game
class card {
    constructor(suit,number,praxis,location,user){
        this.suit = suit;
        this.value = number;
        this.praxis = praxis;
        this.location = location;
        this.xp = 0;
        this.owner = user;
    }
}

class deck {
    constructor(user, role){
        this.user = user;
        this.role = role;
        this.cards = [
            new card("Clubs","A","blank",'deck',user),
            new card("Hearts","A","blank",'deck',user),
            new card("Diamonds","A","blank",'deck',user),
            new card("Spades","A","blank",'deck',user),
            new card("Clubs","2","blank",'deck',user),
            new card("Hearts","2","blank",'deck',user),
            new card("Diamonds","2","blank",'deck',user),
            new card("Spades","2","blank",'deck',user),
            new card("Clubs","3","blank",'deck',user),
            new card("Hearts","3","blank",'deck',user),
            new card("Diamonds","3","blank",'deck',user),
            new card("Spades","3","blank",'deck',user),

            new card("Clubs","4","blank",'deck',user),
            new card("Hearts","4","blank",'deck',user),
            new card("Diamonds","4","blank",'deck',user),
            new card("Spades","4","blank",'deck',user),
            new card("Clubs","5","blank",'deck',user),
            new card("Hearts","5","blank",'deck',user),
            new card("Diamonds","5","blank",'deck',user),
            new card("Spades","5","blank",'deck',user),
            new card("Clubs","6","blank",'reserve',user),
            new card("Hearts","6","blank",'reserve',user),
            new card("Diamonds","6","blank",'reserve',user),
            new card("Spades","6","blank",'reserve',user),

            new card("Clubs","7","blank",'reserve',user),
            new card("Hearts","7","blank",'reserve',user),
            new card("Diamonds","7","blank",'reserve',user),
            new card("Spades","7","blank",'reserve',user),
            new card("Clubs","8","blank",'reserve',user),
            new card("Hearts","8","blank",'reserve',user),
            new card("Diamonds","8","blank",'reserve',user),
            new card("Spades","8","blank",'reserve',user),
            new card("Clubs","9","blank",'reserve',user),
            new card("Hearts","9","blank",'reserve',user),
            new card("Diamonds","9","blank",'reserve',user),
            new card("Spades","9","blank",'reserve',user)
        ];
        if (role == 'Player'){
            this.cards[12].location = 'xp';
            this.cards[13].location = 'xp';
            this.cards[14].location = 'xp';
            this.cards[15].location = 'xp';

            this.cards[16].location = 'reserve';
            this.cards[17].location = 'reserve';
            this.cards[18].location = 'reserve';
            this.cards[19].location = 'reserve';
        }
    }
}

class Praxisgame {
    constructor(admin){
        this.ID = "0001";
        this.admin = admin;
        this.session = -1;
        this.decks = [new deck(admin,"GM")];
    }
};

// make sure the requesting player has a deck in the game and return its index
function find_deck_id(inst_game, new_id){
    let deckid = -1;
    for (let i=0; i<inst_game.decks.length; i++){
        if (inst_game.decks[i].user == new_id){
            deckid = i;
            break;
        }
    }
    return deckid; //returns -1 if there are no matches
}

// find all the indexes of cards in a location (hand, discard, etc)
function find_cards_in_location(deck, loc){
    let cardids = [];
    for (let i=0; i<deck.cards.length; i++){
        if (deck.cards[i].location == loc){
            cardids.push(i);
        }
    }
    return cardids; //returns [] if there are no matches
}

// Increment XP in cards that are soon to be added to the player deck
function gain_exp(deck, suit){
    let cardids = find_cards_in_location(deck, 'xp');
    for (i = 0; i<cardids.length; i++){
        if (deck.cards[cardids[i]].suit == suit){
            let theactualid = cardids[i];
            deck.cards[theactualid].xp += 1;
            if (deck.cards[theactualid].xp == deck.cards[theactualid].value){
                deck.cards[theactualid].location = 'hand'; // move card to hand
                deck.cards[theactualid+4].location = 'xp'; // move next card to xp
                return carddrawn = true;
            } else {
                return carddrawn = false; //GMs have no cards in 'xp' so this function should always return false
            }
        }
    }
}

// Show all the cards in a particular zone in an embed
function show_cards_in_zone(game,message,embed,zone){
    let cardsinzone = [];
    let infotext = [];

    // Find the deck corresponding to the user who asked
    deckid = find_deck_id(game, message.author.id);
    if (deckid == -1){
        message.channel.send('You do not have a deck yet, let alone a '+zone+'! Get your GM to add you as a player');
        return;
    } else {
        cardsinzone = find_cards_in_location(game.decks[deckid],zone);
    }
    // Create an embed to send visual feedback of what's in their discard
    embed = new Discord.MessageEmbed()
    .setTitle('Your '+game.decks[deckid].role + ' '+zone)
    .setColor(0xF1C40F);

    for (let i = 0; i<cardsinzone.length; i++){
        if (zone == 'xp'){
            infotext = game.decks[deckid].cards[cardsinzone[i]].xp;
        } else {
            infotext = game.decks[deckid].cards[cardsinzone[i]].praxis;
        }
        embed.addField((game.decks[deckid].cards[cardsinzone[i]].value + ' of ' + 
        game.decks[deckid].cards[cardsinzone[i]].suit),infotext,true);
    }
    message.channel.send(embed);
    return;
}

function check_card(value, suit){
    all_values = ['A','2','3','4','5','6','7','8','9'];
    all_suits = ['Spades','Diamonds','Clubs','Hearts'];
    return (all_values.includes(value) && all_suits.includes(suit)); 
}

// Passive functions, when the bot starts up
client.on('ready', () =>{
    console.log('This bot is online!');
    mygame = new Praxisgame('none');
})

// Triggers on messages coming in
client.on('message', message=>{
    if (waiting.onReply == true && waiting.user == message.author.id){
        //do stuff, not sure if this is the best way to do this...
    }
    if (message.content[0] != PREFIX){ return };
    let args = message.content.substring(PREFIX.length).split(" "); //I assume this mean args are split by spaces
    switch (args[0].toLowerCase()){
        
        case 'gross': //debugging tool, calling requests from the bot as though it was a player.
            message.channel.send('!'+message.content.slice(PREFIX.length+1+args[0].length));
            message.delete();
            break;


        case 'check':
            deckid = find_deck_id(mygame, message.author.id);
            embed = new Discord.MessageEmbed();
            client.commands.get('check').execute(message,args,mygame.decks[deckid],embed);
            break;


        case 'add':
            if (args.length<2){
                message.channel.send('Ping the user you want to add to the game with an @ message');
            } else {
                for(let i = 1; i < args.length; i++){
                    newplayerid = args[i].substring(3,args[i].length-1);
                    if (newplayerid.length != 18){
                        message.channel.send('Could not add '+newplayerid);
                        break; // not an actual user id
                    }
                    let deckid = find_deck_id(mygame, newplayerid);
                    if (deckid == -1){
                        mygame.decks[mygame.decks.length] = new deck(newplayerid,'Player');
                        message.channel.send('A new player deck was made for <@!'+newplayerid+'>. Welcome to the game!');
                    } else {
                        console.log(newplayerid);
                        console.log(mygame.decks.length);
                        message.channel.send('You already made a deck for this game');
                        return;
                    }
                }
            } 
            break;
        

        case 'draw':
            deckid = find_deck_id(mygame, message.author.id);
            draw_n = parseInt(args[1]);

            if (deckid == -1){
                message.channel.send('Could not find a deck with your name on it. Make sure the GM has added you as a player!');
                return;
            }
            if (isNaN(draw_n)){
                draw_n = 1;
            }

            for (i = 0; i < draw_n; i++){
                client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                console.log('drew a card');
            }
            break;


        case 'ping':
            client.commands.get('ping').execute(message, args);
            console.log();
            break;


        case 'new':
            if (args.length <2){
                message.channel.send('Please specify what you are creating (i.e. !new game).');
                break;
            }
            switch (args[1].toLowerCase()){
                case 'game':
                    if (mygame.admin == 'none'){
                        mygame = new Praxisgame(message.author.id);
                        message.channel.send('<@!'+ message.author.id +'>, Started GMing a new game of Praxis Arcanum! \n'+'Add new players by typing !add @player.');
                    } else {
                        message.channel.send('It looks like there is already a game in session, hosted by <@!'+mygame.admin+'>. Ask them to !save and !close game first.');
                    }
                    break;
        
                case 'deck':
                    if (args.length <3){
                        message.channel.send('Please specify which user will receive a new deck by sending !new deck @<player>.')
                        return;
                    } else {
                        playerid = args[2].substring(3,args[2].length-1);
                        if (playerid.length != 18){
                            message.channel.send('Could not add <@!'+playerid+'> as their id was invalid');
                            return; // not an actual user id
                        }
                    }
                    if (message.author.id == mygame.admin){ //only game admins can make new decks for people

                        let deckid = find_deck_id(mygame, playerid);
                        if (deckid == -1){ //if they don't already have a deck...
                            console.log(playerid);
                            console.log(mygame.decks.length);
                            message.channel.send('<@!'+playerid+'> is not a current player of the game. Use !add @player. !new deck should only be used to remake an existing deck.');
                            return;
                        } else { //if they do have a deck
                            mygame.decks[mygame.decks[deckid]] = new deck(playerid,mygame.decks[deckid].role);
                            message.channel.send('New player deck was remade for <@!'+playerid+'>');
                            return;
                        }
                    }else{
                        message.channel.send('Only game admins can add new decks. Please contact <@!'+mygame.admin+'> to be added to the game in session.')
                    }
                    break;


                case 'episode':
                    args[0] = 'session'; //I'm cheating... not including a break so that it just runs into the next line and executes as through arg[0] was 'session'.

                case 'session':
                    if (message.author.id != mygame.admin){
                        message.channel.send('Only the game admin, <@!' + mygame.admin + '>, can start a new Session.');
                        return;
                    }
                    
                    for (i = 0; i < mygame.decks.length; i++){
                        // send cards in hand, lost, discard back to deck. Keep cards in xp and reserve.
                        let c_idx = find_cards_in_location(mygame.decks[i],'hand').concat(
                            find_cards_in_location(mygame.decks[i],'lost').concat(
                                find_cards_in_location(mygame.decks[i],'discard')));
                        
                        for (j = 0; j<c_idx.length; j++) {
                            let cardx = c_idx[j];
                            mygame.decks[i].cards[cardx].location = 'deck';
                        }
                    }
                    mygame.session += 1;
                    message.channel.send('Now starting Episode ' + mygame.session);
                    break;
                }
            break;


        case 'website':
            embed = new Discord.MessageEmbed()
                .setTitle('Praxis Arcanum')
                .setColor(0xF1C40F)
                .setImage('https://img.itch.zone/aW1hZ2UvNTIxMjMyLzI3MzM5MTMucG5n/347x500/N5i3yR.png')
                .setThumbnail('https://img.itch.zone/aW1hZ2UvNTIxMjMyLzI3MzM5MzMucG5n/347x500/YIfjwS.png')
                .setURL('https://praxisarcanum.itch.io/praxisarcanum')
                .addField('Praxis Arcanum Roleplaying Game','Your actions define you. Play the character you want. Available for $5.');
                message.channel.send(embed);
                message.delete();
            break;


        case 'info':
            if(args[1].toLowerCase() === 'version'){
                message.channel.send('Version 1.0.0');}
            else if (args[1].toLowerCase() === 'praxis'){
                message.channel.send('!website');}
            else{
                message.channel.send('invalid');
            }
            break;

            
        case 'hand': // Shows the player their hand
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'hand');
            break;

        
        case 'deck': // Shows the player their hand
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'deck');
            break;


        case 'discard': // Shows the player their discard
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'discard');
            break;


        case 'reserve': // Shows the player their reserve
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'reserve');
            break;

        
        case 'xp': // Shows the player their reserve
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'xp');
            break;


        case 'lost': // Shows the player their lost cards
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'lost');
            break;


        case 'discard': // Shows the player their xp
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'xp');
            break;
            

        case 'play':
            // confirm we have the card
            if (args.length<4){
                message.channel.send('Please specify the card by number and suit (i.e. !play A of Spades)');
                return;
            }
            c_value = args[1];
            c_suit = args[3];

            cardsinhand = [];
            deckid = find_deck_id(mygame, message.author.id);
            if (deckid == -1){
                message.channel.send('You do not have a deck yet, let alone a hand! Get your GM to add you as a player');
                return;
            } else {
                for (let i = 0; i<mygame.decks[deckid].cards.length; i++){
                    if (mygame.decks[deckid].cards[i].location == 'hand'){
                        cardsinhand.push(i);
                    }
                }
                if (cardsinhand.length < 1){
                    message.channel.send('I couldn\'t find the ' + c_value + ' of ' + c_suit +'. Make sure there were no typos. Check !hand to see what cards you can play.');
                }
            }
            for (let i=0; i<cardsinhand.length; i++){
                if (c_value.toLowerCase() == mygame.decks[deckid].cards[cardsinhand[i]].value.toLowerCase() && c_suit.toLowerCase() == mygame.decks[deckid].cards[cardsinhand[i]].suit.toLowerCase()){
                    console.log('Ding!');
                    if (args.length > 4){
                        if (args[4] == 'praxis'){
                            let praxis_msg = message.content.substring(message.content.search("praxis")+7, message.content.length);
                            mygame.decks[deckid].cards[cardsinhand[i]].praxis = praxis_msg;
                            message.channel.send('Added \"'+praxis_msg+'\" as the Praxis for the '+c_value+' of '+c_suit);
                        }
                    }
                    if (mygame.decks[deckid].role == 'GM'){
                        destination = 'deck';
                    } else if (mygame.decks[deckid].role == 'Player'){
                        destination = 'discard';
                    }
                    mygame.decks[deckid].cards[cardsinhand[i]].location = destination;
                    message.channel.send('Played the '+c_value+' of '+c_suit);

                    let this_made_me_draw_a_card = gain_exp(mygame.decks[deckid],c_suit);
                    if (this_made_me_draw_a_card){
                        message.channel.send('You earned enough experience to gain the next card in '+c_suit);
                    } else {
                        client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                        console.log('drew a card');
                    }
                }
            }
            break;


        case 'motif':
            if (args.length > 1){
                m_suit = args[1]; 
            }
            let suitedcards = [];

            cardsinhand = [];
            deckid = find_deck_id(mygame, message.author.id);
            if (deckid == -1){
                message.channel.send('You do not have a deck yet, let alone a hand! Get your GM to add you as a player');
                return;
            } else {
                for (let i = 0; i<mygame.decks[deckid].cards.length; i++){
                    if (mygame.decks[deckid].cards[i].location == 'hand'){
                        cardsinhand.push(i);
                    }
                }
            }
            if (cardsinhand < 3){
                message.channel.send('You don\'t have enough cards in '+m_suit+' to make a Motif - you need at least 3!');
                return;
            }
            for (let j = 0; j<cardsinhand.length; j++){
                if (m_suit.toLowerCase() == mygame.decks[deckid].cards[cardsinhand[j]].suit.toLowerCase()){
                    console.log('Ding!');
                    suitedcards.push(cardsinhand[j]);

                    if (suitedcards.length == 3){
                        mygame.decks[deckid].cards[suitedcards[0]].location = 'discard';
                        mygame.decks[deckid].cards[suitedcards[1]].location = 'discard';
                        mygame.decks[deckid].cards[suitedcards[2]].location = 'discard';
                        message.channel.send('Played the '+mygame.decks[deckid].cards[suitedcards[0]].value+
                        ', '+mygame.decks[deckid].cards[suitedcards[1]].value+
                        ', and the '+mygame.decks[deckid].cards[suitedcards[2]].value+' of '+m_suit);

                        this_made_me_draw_a_card = gain_exp(mygame.decks[deckid],m_suit);
                        if (this_made_me_draw_a_card){
                            message.channel.send('You earned enough experience to gain the next card in '+m_suit);
                        } else {
                            client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                        }
                        client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                        client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                        console.log('drew 3 cards');
                    }
                }
            }
            break;


        case 'reshuffle':
            if (args.length < 9){
                message.channel.send('Please format your request to reshuffle like this: !reshuffle lose <value> of <suit> and <value> of <suit>');
            } else {
                l_val_1 = args[2];
                l_sui_1 = args[4];
                l_val_2 = args[6];
                l_sui_2 = args[8];
                deckid = find_deck_id(mygame,message.author.id);
                cardids = find_cards_in_location(mygame.decks[deckid],'discard');

                for (i = 0; i<cardids.length; i++){
                    if ( (mygame.decks[deckid].cards[cardids[i]].value==l_val_1)&&(mygame.decks[deckid].cards[cardids[i]].suit==l_sui_1) || 
                    (mygame.decks[deckid].cards[cardids[i]].value==l_val_2)&&(mygame.decks[deckid].cards[cardids[i]].suit==l_sui_2) ){
                        mygame.decks[deckid].cards[cardids[i]].location = 'lost';
                    } else {
                        mygame.decks[deckid].cards[cardids[i]].location = 'deck';
                    }
                }
            }
            break;


        case 'save':
            if (message.author.id == mygame.admin){
                client.savedgames [message.author.id+' in '+message.channel.guild.id] = {
                    game: mygame
                }
                fs.writeFileSync('./savedgames.json',JSON.stringify(client.savedgames, null, 4));
                message.channel.send('Game saved!');
            } else {
                message.channel.send('You are not the admin of the current game, <@!'+mygame.admin+'> is! Please ask them to !save and !close their game.')
            }
            break;


        case 'load':
            //console.log(message.author.id);
            //console.log()
            if (mygame.admin != 'none'){
                message.channel.send('Looks like <@!'+mygame.admin+'> has an active game going. Ask them to !close their game first');
            } else {
                mygame = client.savedgames [message.author.id+' in '+message.channel.guild.id].game;
                message.channel.send('Loaded your previous game, ID: '+mygame.ID);
                for (i=0; i<mygame.decks.length; i++){
                    message.channel.send(mygame.decks[i].role + ' ' + i + ': <@!' + mygame.decks[i].user + '>');
                }
                message.channel.send('Remember, you can start a new session by typing !new session');
            }
            break;


        case 'force':
            if (mygame.admin == message.author.id){
                for (i=0; i<mygame.decks.length; i++){
                    if (args[1] == mygame.decks[i].user){
                        value == args [2];
                        // come back to this after "check card" function

                    }
                }
                
            }
            break;


        case 'close':
            if (args[1] == 'game' && message.author.id == mygame.admin){
                mygame = new Praxisgame('none');
                message.channel.send('Your game is now closed - Thanks for playing! Anyone else can now start their own game.')
            }
            break;






    }
})

client.login(token);