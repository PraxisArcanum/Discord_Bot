// Creating a bot to manage playing Praxis Arcanum RPG
// Basic functionality only: one game admin says !new game, defaulting them to GM, and then can !add @player so they each get a player deck.
//     Player decks have cards 1-3 of each suit, GM has 1-5. Player decks track exp and auto-add new cards, can add Praxes manually when cards are played.
//     Games can be saved by the admin with a !save command, and reloaded later (if the bot goes down) with !load. It automatically pulls the game where you are admin on the server.
//     Every player can view their !deck, !hand, !discard, !xp, !loss, and !reserve at any time.


// TO DO SOME OTHER DAY:
// make sure reshuffle is losing one highest one lowest
// jokers??
// develop at end of session?
// counters for how many times you can resist/swap/help/crucible & hand card limit


// Requires and setup
require('dotenv').config();
const Discord = require('discord.js');
const Deck = require("./deckHelpers.js");

const client = new Discord.Client();
const token = process.env.DISCORD_BOT_TOKEN;
const PREFIX ='!';
const fs = require('fs');
let cardsinhand = [];
let embed = new Discord.MessageEmbed();
var all_games = [];
var mygame;

// Creating a new collection of commands, in the appropriate folder
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles){
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// Creating a file of saved games
client.savedgames = require('./savedgames.json');
client.softsavedgames = require('./softsavedgames.json');

// Constants
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

// Passive functions, when the bot starts up
client.on('ready', () =>{
    console.log('This bot is online!');

    //Soft-load the games that were last in progress, before the bot went down.
    var all_keys = Object.keys(client.softsavedgames);
    for (i = 0; i < all_keys.length; i++) { //Iterates over all games
        mygame = client.softsavedgames[all_keys[i]].game;
        for (k = 0; k < mygame.decks.length; k++) { //Iterates over all decks
            for (j = 0; j < mygame.decks[k].cards.length; j++) { //Iterates over all cards
                mygame.decks[k].cards[j].__proto__ = Deck.card.prototype; //When we load in the deck, it doesn't register the cards as Deck.card objects, so this fixes it.
            }
        }
        if (mygame.active) {
            all_games.push(mygame);
        }
    }
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
        mygame = new Deck.Praxisgame('none','-1',message.channel.id, message.guild.id);
        all_games.push(mygame);
    } else {
        mygame = current_game[0];
    }

    // perform a soft save whenever the GM speaks to the bot, just in case the bot ever goes down.
    if (message.author.id == mygame.admin){
        client.softsavedgames [message.author.id+' in '+message.channel.id] = {
            game: mygame
        }
        fs.writeFileSync('./softsavedgames.json',JSON.stringify(client.softsavedgames, null, 4));
    }

    let args = message.content.substring(PREFIX.length).split(/ +/); //I assume this mean args are split by spaces
    switch (args[0].toLowerCase()){
        
        case 'help':
        case 'commands':
            embed = new Discord.MessageEmbed()
            .setTitle('Praxis Arcanum General Discord Bot Commands')
            .setColor(0xF1C40F)
            .addField('!rules or !demo','Shows you a link to an audio file with a brief overview of the game rules')
            .addField('!new game','Starts a new game with you as the GM. Only one open game can exist per channel. Creates a default GM deck for you too.')
            .addField('!close game','Saves and closes your open game of Praxis, allowing someone else to start a !new game.')
            .addField('!add @player','Adds a user to the open game. Anyone can add anyone as a player. Creates a default player deck for them too.')
            .addField('!save game','Saves your open game. Only one game per GM per channel may be saved.')
            .addField('!load game','Loads a previously saved game.')
            .addField('!new session or !new episode','Keeps XP but moves all cards to their starting positions.')
            .addField('!force @player #value of #suit #property #argument','Forces the property of a card in @player deck to be #argument.')
            .addField('!website or !pdf','Shows you how you can support Praxis Arcanum and pick up the rulebook.')
            .addField('!answer','Used only during Episode Zero. When your GM is ready, they can start a !new session to receive prompts you can !answer.')
            .addField('!migrate #move_channel','Moves the home channel of your game to the specified channel. Useful for running multiple games on one server.');
            message.channel.send(embed);

            embed = new Discord.MessageEmbed()
            .setTitle('Praxis Arcanum In-game Discord Bot Commands')
            .setColor(0xFF38CC)
            .addField('!draw #','Draws a number of cards from your deck into your hand. If # is not specified, draws 1 card.')
            .addField('!play #value of #suit','Plays the specified card from your hand. Add -praxis, -help, or -resist to do one of those special actions.')
            .addField('!motif #suit','Allows you to perform a motif of the specified #suit.')
            .addField('!think quickly','Allows you to think quickly, drawing a card from your deck.')
            .addField('!reshuffle', 'Reshuffles your discard while moving a Joker to the deck')
            .addField('!hand, !xp, !lost, !deck, !discard, or !reserve','Shows you the cards in the respective locations.')
            .addField('!check','Allows the GM to perform a skill check, flipping up cards and replacing them in the deck.')
            .addField('!force @player #value of #suit #property #argument','Forces the property of a card in @player deck to be #argument.')
            .addField('!swap @player #value of #suit','Lets you take the special action to swap cards with another player.')
            .addField('!crucible #value of #suit','Allows you to perform the special Crucible action, sacrificing a card forever.')
            .addField('!harm @player #value of #suit', 'Plays a card from the GM hand, and forces a player to lose all cards of the matching suit from their hand');
            message.channel.send(embed);
            break;

        case 'gross': //debugging tool, calling requests from the bot as though it was a player.
            message.channel.send('!'+message.content.slice(PREFIX.length+1+args[0].length));
            message.delete();
            break;


        case 'check':
            deckid = Deck.find_deck_id(mygame, message.author.id);
            if (message.author.id == mygame.admin) {
                embed = new Discord.MessageEmbed();
                client.commands.get('check').execute(message,args,mygame.decks[deckid],embed,mygame);
                break;
            } else {
                message.channel.send('Only the GM can do !check');
            }

        case 'think':
            if (args[1] == 'quickly'){
                deckid = Deck.find_deck_id(mygame, message.author.id);
                client.commands.get('thinkquickly').execute(message,mygame.decks[deckid],mygame);
                break;
            } else {
                message.channel.send('Did you mean !think quickly?');
            }

        case 'add':
            if (args.length<2){
                message.channel.send('Ping the user you want to add to the game, !add @username');
            } else {
                for(let i = 1; i < args.length; i++){
                    newplayerid = args[i].substring(3,args[i].length-1);
                    if (newplayerid.length != 18){
                        message.channel.send('Could not add '+newplayerid);
                        break; // not an actual user id
                    }
                    let deckid = Deck.find_deck_id(mygame, newplayerid);
                    if (deckid == -1){
                        mygame.decks[mygame.decks.length] = new Deck.deck(newplayerid,'Player');
                        message.guild.channels.create(`${message.guild.members.cache.get(newplayerid).user.username}`, {type: 'text'}).then(
                            m=> {
                                mygame.decks[mygame.decks.length-1].chatchannelid = m.id;
                                mygame.decks[mygame.decks.length-1].chatchannelname = m.name;
                                console.log(mygame.decks[mygame.decks.length-1]);
                                Deck.update_personal_channel(client,mygame,mygame.decks[mygame.decks.length-1]);
                            }
                        );
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
            deckid = Deck.find_deck_id(mygame, message.author.id);
            draw_n = parseInt(args[1]);

            if (deckid == -1){
                message.channel.send('Could not find a deck with your name on it. Make sure the GM has added you as a player!');
                return;
            }
            if (isNaN(draw_n)){
                draw_n = 1;
            }

            client.commands.get('draw').execute(message,args,mygame.decks[deckid], draw_n);
            if (mygame.decks[deckid].chatchannelid != -1){
                Deck.update_personal_channel(client, mygame, mygame.decks[deckid]);
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
                        mygame = new Deck.Praxisgame(message.author.id,message.id,message.channel.id, message.guild.id);
                        mygame.active = true;
                        all_games[thisgameindex] = mygame;

                        message.guild.channels.create(`${message.author.username}`, {type: 'text'}).then(
                            m=> {
                                mygame.decks[mygame.decks.length-1].chatchannelid = m.id;
                                mygame.decks[mygame.decks.length-1].chatchannelname = m.name;
                                console.log(mygame.decks[mygame.decks.length-1]);
                                Deck.update_personal_channel(client,mygame,mygame.decks[mygame.decks.length-1]);
                            }
                        );

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

                        let deckid = Deck.find_deck_id(mygame, playerid);
                        if (deckid == -1){ //if they don't already have a deck...
                            console.log(playerid);
                            message.channel.send('<@!'+playerid+'> is not a current player of the game. Use !add @player. !new deck should only be used to remake an existing deck.');
                            return;
                        } else { //if they do have a deck
                            mygame.decks[deckid] = new Deck.deck(playerid,mygame.decks[deckid].role);
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
                        // find Jokers and put them back in reserve.
                        let j_idx = Deck.find_cards_in_location(mygame.decks[i],'hand').concat(
                            Deck.find_cards_in_location(mygame.decks[i],'deck').concat(
                                Deck.find_cards_in_location(mygame.decks[i],'discard')));
                        for (crd = 0; crd<j_idx.length; crd++) {
                            if (mygame.decks[i].cards[j_idx[crd]].value == 'Joker') {
                                mygame.decks[i].cards[j_idx[crd]].location = 'reserve';
                            }
                            if (mygame.decks[i].cards[j_idx[crd]].max_xp.length == 18) { //hopefully this catches !swapped cards
                                mygame.decks[i].cards[j_idx[crd]].location = 'destroyed';
                            }
                        }
                        
                        // send cards in hand, lost, discard back to deck. Keep cards in xp and reserve.
                        let c_idx = Deck.find_cards_in_location(mygame.decks[i],'hand').concat(
                            Deck.find_cards_in_location(mygame.decks[i],'lost').concat(
                                Deck.find_cards_in_location(mygame.decks[i],'discard')));
                        
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
                .addField('Praxis Arcanum Roleplaying Game','Your actions define you. Create your world. Available for $10.');
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
            Deck.show_cards_in_zone(mygame,message,embed,'hand');
            break;

        case 'run': //changes the messages desplayed in the channel
            let possible_running_modes = ['loud','quiet'];
            if (message.author.id == mygame.admin) {
                if (args.length<2) {
                    message.channel.send('Specify the running mode of bot feedback, either !run loud or !run quiet');
                } else {
                    if (possible_running_modes.includes(args[2])) {
                        mygame.runningmode = args[2];
                    } else {
                        message.channel.send('Specify the running mode as either !run loud or !run quiet');
                    }
                }
                break;
            } else {
                break;
            }

        
        case 'deck': // Shows the player their deck
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'deck');
            break;


        case 'discard': // Shows the player their discard
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'discard');
            break;


        case 'reserve': // Shows the player their reserve
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'reserve');
            break;

        
        case 'xp': // Shows the player their xp
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'xp');
            break;


        case 'lost': // Shows the player their lost cards
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'lost');
            break;
        
        case 'destroyed': // Shows the player their permanently lost cards
            embed = new Discord.MessageEmbed()    
            Deck.show_cards_in_zone(mygame,message,embed,'destroyed');
            break;
            

        case 'play':
            // confirm we have the card
            // instead of this being fixed in place, we could have it look for "of", and choose args[n-1], args[n+1]? Might be weird. Maybe only if the fixed attempt doesn't work?
            let do_resist = args.includes('-resist');
            let do_help = args.includes('-help');
            let do_praxis = args.includes('-praxis') || args.includes('praxis') ;
            let played_a_joker = args.slice(1,3).includes('Joker'); // If "Joker is in the first three arguments"

            if (played_a_joker) {
                message.channel.send('You cannot play a Joker from your hand. It will leave at the start of a !new session.');
                return;
            }

            if (args.length<4){
                message.channel.send('Please specify the card by number and suit (i.e. !play A of Spades)');
                return;
            }
            c_value = args[1];
            c_suit = args[3];

            cardsinhand = [];
            if (!Deck.is_valid_card(c_value,c_suit)){
                message.channel.send('This is not a valid card. Please check your message for typos');
                return;
            }
            deckid = Deck.find_deck_id(mygame, message.author.id);
            if (deckid == -1){
                message.channel.send('You do not have a deck yet, let alone a hand! Get your GM to add you as a player');
                return;
            } else {
                cardsinhand = Deck.find_cards_in_location(mygame.decks[deckid], 'hand');
            }
            foundcards = mygame.decks[deckid].cards.filter(card => (card.value.toLowerCase() == c_value.toLowerCase() && card.suit.toLowerCase() == c_suit.toLowerCase() 
            && card.location.toLowerCase() == 'hand')); // this should only return one card

            console.log(foundcards);

            if (foundcards.length != 1){
                message.channel.send('The card you requested wasn\'t in hand.');
                return;
            }

            // Determine location
            if (mygame.decks[deckid].role == 'GM'){
                if (do_resist || do_help) {
                    message.channel.send('GMs shouldn\'t be resisting or helping. Silly GM. Those moves are for players!');
                }
                destination = 'deck';
                autodraw = false;
            } else if (mygame.decks[deckid].role == 'Player'){
                if (do_resist){
                    destination = 'hand';
                    autodraw = false;
                } else {
                    destination = 'discard';
                    autodraw = true;
                }
            }
            foundcards[0].location = destination;
            message.channel.send('Played the '+c_value+' of '+c_suit);
            let clean_swap = foundcards[0].owner != mygame.decks[deckid].user;

            if (clean_swap){
                Deck.clean_swap(mygame,foundcards[0].max_xp,deckid,foundcards[0]);
            } // the played card was previously swapped

            if (do_praxis && !clean_swap){
                Deck.create_praxis(foundcards[0],message, c_value, c_suit);
            }

            let this_made_me_draw_a_card = false;
            if (!do_help){
                this_made_me_draw_a_card = Deck.gain_exp(mygame.decks[deckid],c_suit);
            } else {
                this_made_me_draw_a_card = false;
            }

            if (this_made_me_draw_a_card){
                message.channel.send('You earned enough experience to gain the next card in '+c_suit);
            } else if (autodraw) {
                client.commands.get('draw').execute(message,args,mygame.decks[deckid],1);
                console.log('drew a card');
            }

            if (do_help){
                mygame.lastcheck
                .addField(message.author.username + '\'s Help Card',foundcards[0].name(),true)
                .addField('Praxis',foundcards[0].praxis,true)
                .addField('\u200B','\u200B',true);

                message.channel.send(mygame.lastcheck);
            } else {
                mygame.lastcheck = new Discord.MessageEmbed()
                .addField(message.author.username + '\'s Played Card',foundcards[0].name(),true)
                .addField('Praxis',foundcards[0].praxis,true)
                .addField('\u200B','\u200B',true);

                message.channel.send(mygame.lastcheck);
            }
            if (mygame.decks[deckid].chatchannelid != -1){
                Deck.update_personal_channel(client, mygame, mygame.decks[deckid]);
            }

            break;

            case 'harm':
                // confirm we have the card
                // instead of this being fixed in place, we could have it look for "of", and choose args[n-1], args[n+1]? Might be weird. Maybe only if the fixed attempt doesn't work?
                // only GM should be able to do this

                recipient = {
                    deckid: [],
                    card: [],
                    id: []
                }
                cardsinhand = [];

                deckid = Deck.find_deck_id(mygame, message.author.id);
                if (deckid == -1){
                    message.channel.send('You do not have a deck yet, let alone a hand! Get your GM to add you as a player');
                    return;
                } else {
                    cardsinhand = Deck.find_cards_in_location(mygame.decks[deckid], 'hand');
                }

                if (mygame.decks[deckid].role == 'GM'){
                    console.log('GM used Harm');
                } else {
                    message.channel.send('Only GMs can use the !harm command');
                    return;
                }

                if (args.length<5){
                    message.channel.send('Please specify the card by number and suit (i.e. !harm @player A of Spades or !harm A of Spades @player)');
                    return;
                }
                if ( (Deck.is_valid_card(args[1],args[3])) && (args[4].length == 22) ) {
                    recipient.id = args[4].substring(3,args[4].length-1);
                    recipient.deckid = Deck.find_deck_id(mygame,recipient.id);
                    c_value = args[1].toLowerCase();
                    c_suit = args[3].toLowerCase();
                } else if ( (Deck.is_valid_card(args[2],args[4])) && (args[1].length == 22) ) {
                    recipient.id = args[1].substring(3,args[1].length-1);
                    recipient.deckid = Deck.find_deck_id(mygame,recipient.id);
                    c_value = args[2].toLowerCase();
                    c_suit = args[4].toLowerCase();
                } else {
                    message.channel.send('Invalid format, please check for typos or type !harm to see how to format the request.');
                    return;
                }
    
                foundcards = mygame.decks[deckid].cards.filter(card => (card.value.toLowerCase() == c_value.toLowerCase() && card.suit.toLowerCase() == c_suit.toLowerCase() 
                && card.location.toLowerCase() == 'hand')); // this should only return one card
        
                if (foundcards.length != 1){
                    message.channel.send('The card you requested wasn\'t in hand.');
                    return;
                }
    
                // Determine location
                destination = 'deck';
                autodraw = false;
                foundcards[0].location = destination;
                message.channel.send('Played the '+c_value+' of '+c_suit+' to cause harm');

                // Remove cards from player's hand
                harmedcards = mygame.decks[recipient.deckid].cards.filter(card => (card.suit.toLowerCase() == c_suit.toLowerCase() && card.location.toLowerCase() == 'hand'));
                for (crd in harmedcards) {
                    harmedcards[crd].location = 'lost';
                    message.channel.send('A card was lost until the end of the session'); // for some reason, the card did not have .name() method
                    client.commands.get('draw').execute(message,args,mygame.decks[recipient.deckid], 1);
                    // draw a card
                }
    
                if (mygame.decks[deckid].chatchannelid != -1){
                    Deck.update_personal_channel(client, mygame, mygame.decks[deckid]);
                }
                if (mygame.decks[recipient.deckid].chatchannelid != -1){
                    Deck.update_personal_channel(client, mygame, mygame.decks[recipient.deckid]);
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
            deckid = Deck.find_deck_id(mygame, message.author.id);
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

                        const this_made_me_draw_a_card = Deck.gain_exp(mygame.decks[deckid],m_suit);
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
            if (args.length > 1){
                message.channel.send('Please format your request to reshuffle like this: !reshuffle');
                break;
            } else {
                deckid = Deck.find_deck_id(mygame,message.author.id);
                cardids = Deck.find_cards_in_location(mygame.decks[deckid],'discard');

                let foundjoker = false;
                reserveids = Deck.find_cards_in_location(mygame.decks[deckid],'reserve');
                for (maybejoker of reserveids) {
                    if (mygame.decks[deckid].cards[maybejoker].value == 'Joker') {
                        foundjoker = true;
                        mygame.decks[deckid].cards[maybejoker].location = 'deck';
                        break;
                    }
                }

                if (foundjoker) {
                    for (c_el of cardids){
                        mygame.decks[deckid].cards[c_el].location = 'deck';
                    }
                    message.channel.send('Reshuffled all cards from discard back in to your deck, and added a Joker.');
                } else {
                    message.channel.send('You have no more jokers remaining to shuffle back in and cannot reshuffle your discard. Use your remaining cards well! All cards are reset at the start of a !new session.');
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

                if (args.filter(cmd => cmd == '-quick').length < 1) {
                    mygame = client.savedgames [message.author.id+' in '+message.channel.id].game;
                } else {
                    mygame = client.softsavedgames [message.author.id+' in '+message.channel.id].game;
                }
                mygame.active = true;
                for (k = 0; k < mygame.decks.length; k++) {
                    for (j = 0; j < mygame.decks[k].cards.length; j++) {
                        mygame.decks[k].cards[j].__proto__ = Deck.card.prototype; //When we load in the deck, it doesn't register the cards as Deck.card objects, so this fixes it.
                    }
                }
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
                deckid = Deck.find_deck_id(mygame, playerid);
                if (deckid == -1){
                    message.channel.send('Could not find a deck for that user.');
                }
                
                c_value = args[2];
                c_suit = args[4];
                if (!Deck.is_valid_card(c_value, c_suit)){
                    message.channel.send('Card format was invalid. Please format as !force @player value of suit property input.');
                    return;
                }
                const forced_card = mygame.decks[deckid].cards.find(card => {
                    return  card.value.toLowerCase() == c_value.toLowerCase() 
                        && card.suit.toLowerCase() == c_suit.toLowerCase() 
                        && card.owner == playerid
                }); // may return a card or undefined
                if (forced_card === undefined){
                    message.channel.send('This card should be valid, but was not found.');
                    return;
                }
                
                const possible_properties = {
                    location: Deck.possible_locations(),
                    value: Deck.possible_values(),
                    suit: Deck.possible_suits(),
                    xp: [0,1,2,3,4,5,6,7,8,9],
                    max_xp: [0,1,2,3,4,5,6,7,8,9],
                };
                const property = args[5].toLowerCase();
                const new_value = args[6];
                switch (property){
                    case 'praxis':
                        Deck.create_praxis(forced_card,message, c_value, c_suit);
                        break;
                    case 'location':
                        if (possible_properties[property].includes(new_value.toLowerCase())){
                            forced_card.location = new_value;
                            message.channel.send('The ' + property + ' of ' + forced_card.name() + ' was forced to ' + new_value + '.');
                        } else {
                            message.channel.send(new_value + ' is not a valid ' + property + '.');
                        }
                        break;
                    case 'value':
                        if (possible_properties[property].includes(new_value.toLowerCase())){
                            forced_card.value = new_value;
                            message.channel.send('The ' + property + ' of ' + forced_card.name() + ' was forced to ' + new_value + '.');
                        } else {
                            message.channel.send(new_value + ' is not a valid ' + property + '.');
                        }
                        break;
                    case 'suit':
                        if (possible_properties[property].includes(new_value.toLowerCase())){
                            forced_card.suit = new_value;
                            message.channel.send('The ' + property + ' of ' + forced_card.name() + ' was forced to ' + new_value + '.');
                        } else {
                            message.channel.send(new_value + ' is not a valid ' + property + '.');
                        }
                        break;
                    case 'xp':
                        if (possible_properties[property].includes(parseInt(new_value))){
                            forced_card.xp = parseInt(new_value);
                            message.channel.send('The ' + property + ' of ' + forced_card.name() + ' was forced to ' + new_value + '.');
                        } else {
                            message.channel.send(new_value + ' is not a valid ' + property + '.');
                        }
                        break;
                    case 'max_xp':
                        if (possible_properties[property].includes(parseInt(new_value))){
                            forced_card.max_xp = parseInt(new_value);
                            message.channel.send('The ' + property + ' of ' + forced_card.name() + ' was forced to ' + new_value + '.');
                            forced_card[property] = parseInt(new_value);
                        } else {
                            message.channel.send(new_value + ' is not a valid ' + property + '.');
                        }
                        break;
                    default:
                        message.channel.send('The property ' + property + ' of cards does not exist, or cannot be forced.');
                        break;
                }  
                
            }
            break;


        case 'close':
            if (args.length < 2) {
                message.channel.send('Please format this request as !close game. Include a -nosave if you DO NOT want it to save on closing.');
            }
            var do_save = true;
            if (args.length = 3) {
                if (args[2] == '-nosave') {
                    do_save = false;
                }
            }
            if (args[1] == 'game' && message.author.id == mygame.admin){
                // TODO: Maybe add a way to close without saving.
                thisgameindex = all_games.findIndex(game => game.channelID == message.channel.id);

                // hard save it
                if (do_save) {
                    mygame.active = false;
                    client.savedgames[message.author.id+' in '+message.channel.id] = {
                        game: mygame
                    }
                    fs.writeFileSync('./savedgames.json',JSON.stringify(client.savedgames, null, 4));
                    message.channel.send('Game saved!');
                }
                // do soft save no matter what
                client.softsavedgames[message.author.id+' in '+message.channel.id] = {
                    game: mygame
                }
                fs.writeFileSync('./softsavedgames.json',JSON.stringify(client.softsavedgames, null, 4));

                // create a new surrogate game
                mygame = new Deck.Praxisgame('none','-1',message.channel.id, message.guild.id);
                all_games[thisgameindex] = mygame;

                message.channel.send('Your game and is now closed - Thanks for playing! Anyone else can now start their own game.')
            }
            break;


        case 'answer':
            if (mygame.session == 0){
                deckid = Deck.find_deck_id(mygame,message.author.id);
                if (deckid == -1){
                    message.channel.send('You aren\'t listed as a player to this game. First, !add @yourself to the game.');
                    return;
                }
                if (mygame.decks[deckid].setup_complete){
                    message.channel.send('Looks like you already completed your deck for Episode Zero. Wait for your GM to start a !new session');
                    return;
                } else {
                    if (mygame.decks[deckid].role == 'GM'){
                        cardorder = [2,0,3,1,7,5,4,6,9,10,11,13,8]; //TODO: This is fragile, may cause a bug at some point.
                        for (i = 0; i < cardorder.length; i++){
                            if (mygame.decks[deckid].cards[cardorder[i]].praxis == 'blank'){
                                if (args.length < 2) {
                                    message.channel.send('Format your answer as !answer <input>.');
                                    message.channel.send(worldbuilding_prompts[i]);
                                    return;
                                }
                                Deck.add_answer(mygame.decks[deckid].cards[cardorder[i]],message);
                                if (i+1 < cardorder.length) {
                                    message.channel.send(worldbuilding_prompts[i+1]);
                                    return;
                                } else {
                                    mygame.decks[deckid].setup_complete = true;
                                    message.channel.send('You\'ve completed your Episode Zero worldbuilding questionaire. '+
                                    'Now, each player should submit their !answer to the following prompts to define their own starting Praxes!');
                                    message.channel.send(characterbuilding_prompts[0]);
                                    return;
                                }
                            }
                        }
                    } else if (mygame.decks[deckid].role == 'Player' && mygame.decks[Deck.find_deck_id(mygame,mygame.admin)].setup_complete){ //needs player incomplete, GM complete
                        var cardorder = [10,8,11,9];
                        for (i = 0; i < cardorder.length; i++){
                            if (mygame.decks[deckid].cards[cardorder[i]].praxis == 'blank'){
                                if (args.length < 2) {
                                    message.channel.send('Format your answer as !answer <input>.');
                                    message.channel.send(characterbuilding_prompts[i]);
                                    return;
                                }
                                Deck.add_answer(mygame.decks[deckid].cards[cardorder[i]],message); //writes the answer on a blank card
                                if (i != cardorder.length-1) { // so long as we didnt just write on the last card in order,
                                    message.channel.send(message.author.username+': '+characterbuilding_prompts[i+1]); // send the next prompt
                                    return;
                                } else {
                                    mygame.decks[deckid].setup_complete = true;
                                    message.channel.send(message.author.username+': '+'You\'ve completed your Episode Zero character questionaire. ' +
                                    'Now, each player should discuss how their know at least one other PC. Then the GM can start the !new session!');
                                    return;
                                }   
                            }                            
                        }
                        // If you got here without a return, it's because you reached the end of cardorder without finding a blank.
                        message.channel.send('Looks like you\'re all done for now. Just sit tight until all players finish answering, then your GM can start a !new session.');
                    } else {
                        message.channel.send('Please wait for the GM to finish their !answer to the GM worldbuilding first.');
                        return;
                    }
                }
            } else {
                message.channel.send('This command only works in Episode Zero.');
                return;
            }

        case 'summary':
            message.channel.send(mygame.lastcheck);
            return;

        case 'swap':
            // Allows you to trade cards with another player. A card from the calling player's hand goes to the receiving player
            let sender = {
                deckid: Deck.find_deck_id(mygame,message.author.id),
                card: []
            };
            recipient = {
                deckid: [],
                card: [],
                id: []
            }

            if (args.length < 4) {
                message.channel.send('Please format as !swap @player #value of #suit or !swap #value of #suit @player.');
                return;
            }

            let swap_joker = args.includes('Joker'); // If "Joker is in the arguments
            if (swap_joker) {
                message.channel.send('You cannot swap a Joker from your hand. It will leave at the start of a !new session.');
                return;
            }

            if ( (Deck.is_valid_card(args[1],args[3])) && (args[4].length == 22) ) {
                recipient.id = args[4].substring(3,args[4].length-1);
                recipient.deckid = Deck.find_deck_id(mygame,recipient.id);
                c_value = args[1].toLowerCase();
                c_suit = args[3].toLowerCase();
            } else if ( (Deck.is_valid_card(args[2],args[4])) && (args[1].length == 22) ) {
                recipient.id = args[1].substring(3,args[1].length-1);
                recipient.deckid = Deck.find_deck_id(mygame,recipient.id);
                c_value = args[2].toLowerCase();
                c_suit = args[4].toLowerCase();
            }
            sender.card = mygame.decks[sender.deckid].cards.filter(card => ( (card.location == 'hand') && (card.value.toLowerCase() == c_value) && (card.suit.toLowerCase() == c_suit) ) )[0];

            if ( (recipient.deckid == sender.deckid) || (recipient.deckid == -1) ) {
                message.channel.send('This was an invalid player to swap cards with.');
                return;
            }
            mygame.decks[recipient.deckid].cards[mygame.decks[recipient.deckid].cards.length] = 
            (new Deck.card(sender.card.suit, sender.card.value, sender.deckid, sender.card.praxis, sender.card.location, sender.card.owner));
            // I've hijacked the max_xp field for swaps.
            recipient.card = mygame.decks[recipient.deckid].cards[mygame.decks[recipient.deckid].cards.length-1];

            sender.card.location = 'swap';
            message.channel.send('Card swapped. Make sure to receive one back if you haven\'t already');
            break;
        
        case 'crucible':
            // Should be !crucible value of suit and needs to have a praxis. Will interact with Praxisgame.lastcheck
            if (args.length < 4) {
                message.channel.send('Please format as !crucible #value of #suit. Crucibles must have a Praxis and be in your hand.');
                return;
            } else {
                if (Deck.is_valid_card(args[1],args[3])) {
                    deckid = Deck.find_deck_id(mygame,message.author.id);
                    crucible_card = mygame.decks[deckid].cards.filter( n => (n.location == 'hand' && 
                    n.praxis != 'blank' &&
                    n.value.toLowerCase() == args[1].toLowerCase() && 
                    n.suit.toLowerCase() == args[3].toLowerCase()) );
                    if (crucible_card.length < 1) {
                        message.channel.send('Could not find the crucible card in your !hand');
                        return;
                    }
                    crucible_card[0].location = 'destroyed';
                    
                    mygame.lastcheck
                    .addField(message.author.username + '\'s Crucible Card',crucible_card[0].name(),true)
                    .addField('Praxis',crucible_card[0].praxis,true)
                    .addField('\u200B','\u200B',true);

                    message.channel.send(mygame.lastcheck);
                } else {
                    message.channel.send('That card doesn\'t exist. Check for typos.');
                }
            }
            break;

        case 'migrate':
            // move a game from one channel to another in the same server
            if (args.length < 2) {
                message.channel.send('Please format as !migrate #channel.');
            }
            console.log(args);
            
            // overwrite the existing save with a blank
            client.savedgames[message.author.id+' in '+message.channel.id] = {
                game: new Deck.Praxisgame('none','-1',message.channel.id, message.guild.id)
            }
            fs.writeFileSync('./savedgames.json',JSON.stringify(client.savedgames, null, 4));
            
            if (args[1].length == 21) {
                movefrom = mygame.channelID;
                moveto = args[1].substring(2,20);
                mygame.channelID = moveto;
                message.channel.send('Game migrated from <#'+ movefrom + '> to <#' + moveto + '>'); // This WILL overwrite the game if it's migrated to a channel with another game.
                
                mygame.active = false;
                client.savedgames[message.author.id+' in '+ moveto] = {
                    game: mygame
                }
                fs.writeFileSync('./savedgames.json',JSON.stringify(client.savedgames, null, 4));
                all_games.pop(all_games.indexOf(mygame)); // delete the game where it is (to ensure we don't have two open games in the moveto channel).

            } else {
                message.channel.send('Please format as !migrate #channel.');
            }




    }
})

client.login(token);