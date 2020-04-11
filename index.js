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


// Requires and setup
require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const token = process.env.DISCORD_BOT_TOKEN;
const PREFIX ='!';
const fs = require('fs');
let cardsinhand = [];
let cardsindiscard = [];
let embed = new Discord.MessageEmbed();
var all_games = [];
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
        this.setup_complete = false;
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
    constructor(admin, messageID, chID){
        this.ID = messageID;
        this.admin = admin;
        this.session = -1;
        this.decks = [new deck(admin,"GM")];
        this.channelID = chID;
    }
};

const worldbuilding_prompts = [
    'What is a prominent theme, element, or location of the game? What tropes does that bring to mind?',
    'What is an important piece of technology in the world? How does it work?',
    'What is supernatural about the world? This will be \"The Weird\". Who has access?',
    'What is the cost or limit to wielding the Weird? What happens when those limits are reached?',
    'What is dangerous about weilding the Weird? Who is most vulnerable?',
    'What is the nature of a current or recent conflict? How divided are people?',
    'What is one of the deadliest hazards of the world? How have you adapted?',
    'What important faction exists and what do they represent? Are there rival factions?',
    'What is a secret, unknown to you, that someone in the world knows? How would one learn this secret?',
    'What is the most valuable good or service and why? What kind of risks are taken to acquire it?',
    'Who is a figure of authority in the world. What gives them their authority?',
    'What goal do you collectively seek to accomplish? How do you measure success?',
    'Who opposes you in your goal? What is their agenda?'
];

const characterbuilding_prompts = [
    'Where is your character from? What made you leave?',
    'What tool do you carry with you that has helped you get out of a jam? How did you learn to use it?',
    'What does it mean for you to wield \"The Weird\"? What consequences come when you use it?',
    'What motivated you to devote yourself to your goal? What did you have to lose?'
]

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

function create_praxis(card, message, c_value, c_suit){
    let praxis_msg = message.content.substring(message.content.search("praxis")+7, message.content.length);
    card.praxis = praxis_msg;
    message.channel.send('Added \"'+praxis_msg+'\" as the Praxis for the '+c_value+' of '+c_suit);
    return;
}

function add_answer(card, message, c_value, c_suit){
    let answer_msg = message.content.substring(message.content.search("answer")+7, message.content.length);
    card.praxis = answer_msg;
    message.channel.send('Added \"'+answer_msg+'\" as the answer');
    return;
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

// Cut down a list of card indeces to those that match a property.
function card_ids_that_match_prop(allcardids,deck,property_type,property_name){
    const matching_indeces = [];

    //if no card ids are specified, it will go through every card in the deck
    if (allcardids == ''){
        for (i=0; i<deck.cards.length; i++){
            allcardids.push(i);
        }
    }

    // compare, based on which property was selected
    switch (property_type.toLowerCase){
        case 'suit':
            for (i=1; i<allcardids.length; i++){
                if (deck.cards[i].suit == property_name)
                    matching_indeces.push(i);
            }
            return matching_indeces;
        case 'value':
            for (i=1; i<allcardids.length; i++){
                if (deck.cards[i].value == property_name)
                    matching_indeces.push(i);
            }
            return matching_indeces;
        case 'owner':
            for (i=1; i<allcardids.length; i++){
                if (deck.cards[i].owner == property_name)
                    matching_indeces.push(i);
            }
            return matching_indeces;
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

function is_valid_card(value, suit){
    all_values = ['a','2','3','4','5','6','7','8','9'];
    all_suits = ['spades','diamonds','clubs','hearts'];
    return (all_values.includes(value.toLowerCase()) && all_suits.includes(suit.toLowerCase())); 
}

// Passive functions, when the bot starts up
client.on('ready', () =>{
    console.log('This bot is online!');
})

// Triggers on messages coming in
client.on('message', message=>{

    if (message.content[0] != PREFIX){ return }; // Unless you start with !, you're not talking to me.
    console.log(message.content);

    current_game = all_games.filter(game => game.channelID == message.channel.id); // Make sure that there is a game associated with this channel
    if (current_game.length > 1){
        message.channel.send('There are too many games associated with this channel. This is a bug. Honestly, this command should never execute.');
        return;
    }
    if (current_game.length < 1){ // if no game was ever made for this channel...
        mygame = new Praxisgame('none','-1',message.channel.id);
        all_games.push(mygame);
    } else {
        mygame = current_game[0];
    }

    let args = message.content.substring(PREFIX.length).split(" "); //I assume this mean args are split by spaces
    switch (args[0].toLowerCase()){
        
        case 'help':
        case 'commands':
            embed = new Discord.MessageEmbed()
            .setTitle('Praxis Arcanum Discord Bot Commands')
            .setColor(0xF1C40F)
            .addField('!rules or !demo','Shows you a link to an audio file with a brief overview of the game rules')
            .addField('!new game','Starts a new game with you as the GM. Only one open game can exist per channel. Creates a default GM deck for you too.')
            .addField('!close game','Closes an open game, allowing someone else to start a game.')
            .addField('!add @player','Adds a user to the open game. Anyone can add anyone as a player. Creates a default player deck for them too.')
            .addField('!save game','Saves your open game. Only one game per GM per channel may be saved.')
            .addField('!load game','Loads a previously saved game.')
            .addField('!new session or !new episode','Keeps XP but moves all cards to their starting positions.')
            .addField('!draw #','Draws a number of cards from your deck into your hand. If # is not specified, draws 1.')
            .addField('!play #value of #suit','Plays the specified card from your hand.')
            .addField('!motif #suit','Allows you to perform a motif of the specified #suit')
            .addField('!reshuffle #value of #suit and #value2 of #suit2', 'Reshuffles your discard while moving two specified cards to lost')
            .addField('!hand, !xp, !lost, !deck, !discard, or !reserve','Shows you the cards in the respective locations.')
            .addField('!check','Allows the GM to perform a skill check, flipping up cards and replacing them in the deck.')
            .addField('!force @player #value of #suit #property #argument','Forces the property of a card in @player deck to be #argument.')
            .addField('!website or !pdf','Shows you how you can support Praxis Arcanum and pick up the rulebook');
            break;

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
                        thisgameindex = all_games.findIndex(game => game.channelID == message.channel.id);
                        mygame = new Praxisgame(message.author.id,message.id,message.channel.id);
                        all_games[thisgameindex] = mygame;
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
                    if (mygame.session == 0){
                        message.channel.send('Session Zero requires the completion of a Worldbuilding questionnaire. '+
                        'Discuss your answers to the following questions. The GM will !answer with a summarized version.');
                        message.channel.send(worldbuilding_prompts[0]);
                    }
                    break;
                }
            break;

        case 'pdf':
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
        
        case 'demo':
        case 'rules':
            embed = new Discord.MessageEmbed()
                .setTitle('Praxis Arcanum Rules Summary')
                .setColor(0xF1C40F)
                .setImage('https://img.itch.zone/aW1hZ2UvNTIxMjMyLzI3MzM5MTMucG5n/347x500/N5i3yR.png')
                .setThumbnail('https://img.itch.zone/aW1hZ2UvNTIxMjMyLzI3MzM5MzMucG5n/347x500/YIfjwS.png')
                .setURL('https://soundcloud.com/user-185271841/praxis-arcanum-rules-summary')
                .addField('Praxis Arcanum Roleplaying Game','A brief summary of the rules to Praxis Arcanum. For the full set of rules, type !pdf to get the rulebook!');
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

        
        case 'deck': // Shows the player their deck
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

        
        case 'xp': // Shows the player their xp
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'xp');
            break;


        case 'lost': // Shows the player their lost cards
            embed = new Discord.MessageEmbed()    
            show_cards_in_zone(mygame,message,embed,'lost');
            break;
            

        case 'play':
            // confirm we have the card
            if (args.length<4){
                message.channel.send('Please specify the card by number and suit (i.e. !play A of Spades)');
                return;
            }
            c_value = args[1];
            c_suit = args[3];
            if (!is_valid_card(c_value,c_suit)){
                message.channel.send('This is not a valid card. Please check your message for typos');
                return;
            }
            deckid = find_deck_id(mygame, message.author.id);
            if (deckid == -1){
                message.channel.send('You do not have a deck yet, let alone a hand! Get your GM to add you as a player');
                return;
            } else {
                cardsinhand = find_cards_in_location(mygame.decks[deckid], 'hand');
            }
            foundcards = mygame.decks[deckid].cards.filter(card => card.value.toLowerCase() == c_value.toLowerCase() && card.suit.toLowerCase() == c_suit.toLowerCase() 
            && card.location.toLowerCase() == 'hand');

            if (foundcards.length != 1){
                message.channel.send('The card you requested wasn\'t in hand.');
                return;
            }

            // Determine location
            if (mygame.decks[deckid].role == 'GM'){
                destination = 'deck';
                autodraw = false;
            } else if (mygame.decks[deckid].role == 'Player'){
                if (args[args.length-1].toLowerCase() == '!resist'){
                    desination = 'hand';
                    autodraw = false;
                }
                destination = 'discard';
                autodraw = true;
            }
            foundcards[0].location = destination;
            message.channel.send('Played the '+c_value+' of '+c_suit);

            if (args.includes('praxis')){
                create_praxis(foundcards[0],message, c_value, c_suit);
            }

            let this_made_me_draw_a_card = gain_exp(mygame.decks[deckid],c_suit);
            
            if (this_made_me_draw_a_card){
                message.channel.send('You earned enough experience to gain the next card in '+c_suit);
            } else if (autodraw) {
                client.commands.get('draw').execute(message,args,mygame.decks[deckid]);
                console.log('drew a card');
            }
            break;


        case 'motif':
            if (args.length > 1){
                m_suit = args[1]; 
            } else {
                message.channel.send('You need to specify a suit, for example, !motif Spades');
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

                        const this_made_me_draw_a_card = gain_exp(mygame.decks[deckid],m_suit);
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
                client.savedgames [message.author.id+' in '+message.channel.id] = {
                    game: mygame
                }
                fs.writeFileSync('./savedgames.json',JSON.stringify(client.savedgames, null, 4));
                message.channel.send('Game saved!');
            } else {
                message.channel.send('You are not the admin of the current game, <@!'+mygame.admin+'> is! Please ask them to !save and !close their game.')
            }
            break;


        case 'load':
            if (mygame.admin != 'none'){
                message.channel.send('Looks like <@!'+mygame.admin+'> has an active game going. Ask them to !save and !close their game first');
            } else {
                thisgameindex = all_games.findIndex(game => game.channelID == message.channel.id);
                attempt_to_load = client.savedgames[message.author.id + ' in ' + message.channel.id];

                if (typeof attempt_to_load == 'undefined'){
                    message.channel.send('Failure to load game. You either have no saved games, or are in the wrong channel.'+
                    'If you would like to move a game from another channel to this one, send a command using the !migrate function from that original channel.');
                    console.log(message.author.id + ' in ' + message.channel.id);
                    return;
                }

                mygame = client.savedgames [message.author.id+' in '+message.channel.id].game;
                all_games[thisgameindex] = mygame;
                
                message.channel.send('Loaded your previous game, ID: '+mygame.ID);
                for (i=0; i<mygame.decks.length; i++){
                    message.channel.send(mygame.decks[i].role + ' ' + i + ': <@!' + mygame.decks[i].user + '>');
                }
                message.channel.send('Remember, you can start a new session by typing !new session');
            }
            break;


        case 'force':
            if (args.length < 7){
                message.channel.send('Forces properties of a card. Format as !force @player value of suit property input');
                return;
            }
            if (mygame.admin == message.author.id){
                playerid = args[1].substring(3,args[1].length-1);
                if (playerid.length != 18){
                    message.channel.send('Could not force cards for <@!'+playerid+'> as their id was invalid');
                    return; // not an actual user id
                }
                deckid = find_deck_id(mygame, playerid);
                if (deckid == -1){
                    message.channel.send('Could not find a deck for that user.');
                }
                
                c_value = args[2];
                c_suit = args[4];
                if (!is_valid_card(c_value, c_suit)){
                    message.channel.send('Card format was invalid. Please format as !force @player value of suit property input.');
                    return;
                }
                forcedcard = mygame.decks[deckid].cards.filter(card => card.value == c_value && card.suit == c_suit && card.owner == playerid); // should only return one card
                if (forcedcard.length != 1){
                    message.channel.send('This card was an invalid part of the deck. Either too many or too few of them exist. This is a weird bug.');
                }
                
                switch (args[5].toLowerCase()){
                    case 'location':
                        const possible_locations = ['hand','deck','xp','discard','lost','reserve'];
                        if (possible_locations.includes(args[6].toLowerCase())){
                            forcedcard[0].location = args[6];
                        }
                        message.channel.send('The ' + c_value + ' of ' + c_suit + 'was forced to the ' + args[6]);
                        break;
                    case 'praxis':
                        create_praxis(forcedcard[0],message, c_value, c_suit);
                        break;
                    case 'value':
                        const possible_values = ['a','2','3','4','5','6','7','8','9'];
                        if (possible_values.includes(args[6].toLowerCase())){
                            forcedcard[0].value = args[6];
                        }
                        message.channel.send('The ' + c_value + ' of ' + c_suit + 'was forced to become a ' + args[6]);
                        break;
                    case 'suit':
                        const possible_suits = ['clubs','spades','diamonds','hearts'];
                        if (possible_suits.includes(args[6].toLowerCase())){
                            forcedcard[0].suit = args[6];
                        }
                        message.channel.send('The ' + c_value + ' of ' + c_suit + 'was forced to become a ' + args[6]);
                        break;
                }  
                
            }
            break;


        case 'close':
            if (args[1] == 'game' && message.author.id == mygame.admin){

                thisgameindex = all_games.findIndex(game => game.channelID == message.channel.id);
                mygame = new Praxisgame('none','-1',message.channel.id);
                all_games[thisgameindex] = mygame;

                message.channel.send('Your game is now closed - Thanks for playing! Anyone else can now start their own game.')
            }
            break;


        case 'answer':
            if (mygame.session == 0){
                deckid = find_deck_id(mygame,message.author.id);
                if (deckid == -1){
                    message.channel.send('You aren\'t listed as a player to this game. First, !add @yourself to the game.');
                    return;
                }
                if (mygame.decks[deckid].setup_complete){
                    message.channel.send('Looks like you already completed your deck for Episode Zero. Wait for your GM to start a !new session');
                    return;
                } else {
                    if (mygame.decks[deckid].role == 'GM'){
                        cardorder = [2,0,3,1,7,5,4,6,9,10,11,13,8];
                        for (i = 0; i < cardorder.length; i++){
                            if (mygame.decks[deckid].cards[cardorder[i]].praxis == 'blank'){
                                add_answer(mygame.decks[deckid].cards[cardorder[i]],message);
                                message.channel.send(worldbuilding_prompts[i+1]);
                                return;
                            }
                        }
                        mygame.decks[deckid].setup_complete = true;
                        message.channel.send('You\'ve completed your Session Zero worldbuilding questionaire. '+
                        'Now, each player should submit their !answer to the following prompts to define their own starting Praxes!');
                        message.channel.send(characterbuilding_prompts[0]);
                        return;
                    } else if (mygame.decks[deckid].role == 'Player' && mygame.decks[find_deck_id(mygame,mygame.admin)].setup_complete){ //needs player incomplete, GM complete
                        cardorder = [2,0,3,1];
                        for (var cardid in cardorder){
                            if (mygame.decks[deckid].cards[cardid].praxis == 'blank'){
                                add_answer(mygame.decks[deckid].cards[cardid],message);
                                message.channel.send(characterbuilding_prompts[cardorder.findIndex(cardid)]);
                                return;
                            }
                            mygame.decks[deckid].setup_complete = true;
                            message.channel.send('You\'ve completed your Session Zero character questionaire. ' +
                            'Now, each player should discuss how their know at least one other PC. Then the GM can start the !new session!');
                            return;
                        }
                    } else {
                        message.channel.send('Please wait for the GM to finish their !answer to the GM worldbuilding first.');
                        return;
                    }
                }
            } else {
                message.channel.send('This command only works in Session Zero.');
                return;
            }






    }
})

client.login(token);