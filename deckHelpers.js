const Discord = require("discord.js");

class card {
    constructor(suit, number, praxis, location, user) {
        this.suit = suit;
        this.value = number;
        this.praxis = praxis;
        this.location = location;
        this.xp = 0;
        this.owner = user;
    }
}

class deck {
    constructor(user, role) {
        this.user = user;
        this.role = role;
        this.cards = [
            new card("Clubs", "A", "blank", "deck", user),
            new card("Hearts", "A", "blank", "deck", user),
            new card("Diamonds", "A", "blank", "deck", user),
            new card("Spades", "A", "blank", "deck", user),
            new card("Clubs", "2", "blank", "deck", user),
            new card("Hearts", "2", "blank", "deck", user),
            new card("Diamonds", "2", "blank", "deck", user),
            new card("Spades", "2", "blank", "deck", user),
            new card("Clubs", "3", "blank", "deck", user),
            new card("Hearts", "3", "blank", "deck", user),
            new card("Diamonds", "3", "blank", "deck", user),
            new card("Spades", "3", "blank", "deck", user),

            new card("Clubs", "4", "blank", "deck", user),
            new card("Hearts", "4", "blank", "deck", user),
            new card("Diamonds", "4", "blank", "deck", user),
            new card("Spades", "4", "blank", "deck", user),
            new card("Clubs", "5", "blank", "deck", user),
            new card("Hearts", "5", "blank", "deck", user),
            new card("Diamonds", "5", "blank", "deck", user),
            new card("Spades", "5", "blank", "deck", user),
            new card("Clubs", "6", "blank", "reserve", user),
            new card("Hearts", "6", "blank", "reserve", user),
            new card("Diamonds", "6", "blank", "reserve", user),
            new card("Spades", "6", "blank", "reserve", user),

            new card("Clubs", "7", "blank", "reserve", user),
            new card("Hearts", "7", "blank", "reserve", user),
            new card("Diamonds", "7", "blank", "reserve", user),
            new card("Spades", "7", "blank", "reserve", user),
            new card("Clubs", "8", "blank", "reserve", user),
            new card("Hearts", "8", "blank", "reserve", user),
            new card("Diamonds", "8", "blank", "reserve", user),
            new card("Spades", "8", "blank", "reserve", user),
            new card("Clubs", "9", "blank", "reserve", user),
            new card("Hearts", "9", "blank", "reserve", user),
            new card("Diamonds", "9", "blank", "reserve", user),
            new card("Spades", "9", "blank", "reserve", user),
        ];
        if (role == "Player") {
            this.cards[12].location = "xp";
            this.cards[13].location = "xp";
            this.cards[14].location = "xp";
            this.cards[15].location = "xp";

            this.cards[16].location = "reserve";
            this.cards[17].location = "reserve";
            this.cards[18].location = "reserve";
            this.cards[19].location = "reserve";
        }
    }
}

class Praxisgame {
    constructor(admin) {
        this.ID = "0001";
        this.admin = admin;
        this.session = -1;
        this.decks = [new deck(admin, "GM")];
    }
}

// make sure the requesting player has a deck in the game and return its index
function find_deck_id(inst_game, new_id) {
    let deckid = -1;
    for (let i = 0; i < inst_game.decks.length; i++) {
        if (inst_game.decks[i].user == new_id) {
            deckid = i;
            break;
        }
    }
    return deckid; //returns -1 if there are no matches
}

// find all the indexes of cards in a location (hand, discard, etc)
function find_cards_in_location(deck, loc) {
    let cardids = [];
    for (let i = 0; i < deck.cards.length; i++) {
        if (deck.cards[i].location == loc) {
            cardids.push(i);
        }
    }
    return cardids; //returns [] if there are no matches
}

// Increment XP in cards that are soon to be added to the player deck
function gain_exp(deck, suit) {
    let cardids = find_cards_in_location(deck, "xp");
    for (i = 0; i < cardids.length; i++) {
        if (deck.cards[cardids[i]].suit == suit) {
            let theactualid = cardids[i];
            deck.cards[theactualid].xp += 1;
            if (deck.cards[theactualid].xp == deck.cards[theactualid].value) {
                deck.cards[theactualid].location = "hand"; // move card to hand
                deck.cards[theactualid + 4].location = "xp"; // move next card to xp
                return (carddrawn = true);
            } else {
                return (carddrawn = false); //GMs have no cards in 'xp' so this function should always return false
            }
        }
    }
}

// Show all the cards in a particular zone in an embed
function show_cards_in_zone(game, message, embed, zone) {
    let cardsinzone = [];
    let infotext = [];

    // Find the deck corresponding to the user who asked
    deckid = find_deck_id(game, message.author.id);
    if (deckid == -1) {
        message.channel.send(
            "You do not have a deck yet, let alone a " +
                zone +
                "! Get your GM to add you as a player"
        );
        return;
    } else {
        cardsinzone = find_cards_in_location(game.decks[deckid], zone);
    }
    // Create an embed to send visual feedback of what's in their discard
    embed = new Discord.MessageEmbed()
        .setTitle("Your " + game.decks[deckid].role + " " + zone)
        .setColor(0xf1c40f);

    for (let i = 0; i < cardsinzone.length; i++) {
        if (zone == "xp") {
            infotext = game.decks[deckid].cards[cardsinzone[i]].xp;
        } else {
            infotext = game.decks[deckid].cards[cardsinzone[i]].praxis;
        }
        embed.addField(
            game.decks[deckid].cards[cardsinzone[i]].value +
                " of " +
                game.decks[deckid].cards[cardsinzone[i]].suit,
            infotext,
            true
        );
    }
    message.channel.send(embed);
    return;
}

function check_card(value, suit) {
    all_values = ["A", "2", "3", "4", "5", "6", "7", "8", "9"];
    all_suits = ["Spades", "Diamonds", "Clubs", "Hearts"];
    return all_values.includes(value) && all_suits.includes(suit);
}

module.exports = {
    card,
    deck,
    Praxisgame,
    find_cards_in_location,
    gain_exp,
    show_cards_in_zone,
    find_deck_id,
};
