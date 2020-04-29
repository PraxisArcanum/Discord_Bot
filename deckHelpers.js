/**
 * @prettier
 */

const Discord = require("discord.js");

// Define essential classes: Cards, Decks, Game
class card {
    constructor(suit, number, max_xp, praxis, location, user) {
        this.suit = suit;
        this.value = number;
        this.praxis = praxis;
        this.location = location;
        this.xp = 0;
        this.max_xp = max_xp;
        this.owner = user;
    }
    name() {
        return this.value + " of " + this.suit;
    }
}

class deck {
    constructor(user, role) {
        this.user = user;
        this.role = role;
        this.setup_complete = false;
        this.cards = [
            new card("Clubs", "A", 1, "blank", "deck", user),
            new card("Hearts", "A", 1, "blank", "deck", user),
            new card("Diamonds", "A", 1, "blank", "deck", user),
            new card("Spades", "A", 1, "blank", "deck", user),
            new card("Clubs", "2", 2, "blank", "deck", user),
            new card("Hearts", "2", 2, "blank", "deck", user),
            new card("Diamonds", "2", 2, "blank", "deck", user),
            new card("Spades", "2", 2, "blank", "deck", user),
            new card("Clubs", "3", 3, "blank", "deck", user),
            new card("Hearts", "3", 3, "blank", "deck", user),
            new card("Diamonds", "3", 3, "blank", "deck", user),
            new card("Spades", "3", 3, "blank", "deck", user),

            new card("Clubs", "4", 4, "blank", "deck", user),
            new card("Hearts", "4", 4, "blank", "deck", user),
            new card("Diamonds", "4", 4, "blank", "deck", user),
            new card("Spades", "4", 4, "blank", "deck", user),
            new card("Clubs", "5", 5, "blank", "deck", user),
            new card("Hearts", "5", 5, "blank", "deck", user),
            new card("Diamonds", "5", 5, "blank", "deck", user),
            new card("Spades", "5", 5, "blank", "deck", user),
            new card("Clubs", "6", 6, "blank", "reserve", user),
            new card("Hearts", "6", 6, "blank", "reserve", user),
            new card("Diamonds", "6", 6, "blank", "reserve", user),
            new card("Spades", "6", 6, "blank", "reserve", user),

            new card("Clubs", "7", 7, "blank", "reserve", user),
            new card("Hearts", "7", 7, "blank", "reserve", user),
            new card("Diamonds", "7", 7, "blank", "reserve", user),
            new card("Spades", "7", 7, "blank", "reserve", user),
            new card("Clubs", "8", 8, "blank", "reserve", user),
            new card("Hearts", "8", 8, "blank", "reserve", user),
            new card("Diamonds", "8", 8, "blank", "reserve", user),
            new card("Spades", "8", 8, "blank", "reserve", user),
            new card("Clubs", "9", 9, "blank", "reserve", user),
            new card("Hearts", "9", 9, "blank", "reserve", user),
            new card("Diamonds", "9", 9, "blank", "reserve", user),
            new card("Spades", "9", 9, "blank", "reserve", user),
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
    constructor(admin, messageID, chID) {
        this.ID = messageID;
        this.admin = admin;
        this.session = -1;
        this.decks = [new deck(admin, "GM")];
        this.channelID = chID;
        this.lastcheck = new Discord.MessageEmbed();
        this.active = false;
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

function create_praxis(card, message, c_value, c_suit) {
    let praxis_msg = message.content.substring(
        message.content.search("praxis") + 7,
        message.content.length
    );
    card.praxis = praxis_msg;
    message.channel.send(
        'Added "' +
            praxis_msg +
            '" as the Praxis for the ' +
            c_value +
            " of " +
            c_suit
    );
    return;
}

function add_answer(card, message, c_value, c_suit) {
    let answer_msg = message.content.substring(
        message.content.search("answer") + 7,
        message.content.length
    );
    card.praxis = answer_msg;
    message.channel.send('Added "' + answer_msg + '" as the answer');
    return;
}

// Increment XP in cards that are soon to be added to the player deck.
// If a card hits max xp, move it to hand and return true to indicate a drawn card.
// ELse, returns false.
function gain_exp(deck, suit) {
    const xp_cards = cards_in_location(deck, "xp");
    const card = xp_cards.find(
        (card) => card.suit.toLowerCase() == suit.toLowerCase()
    );
    console.log((card ? card.name() : undefined) + " gained xp");
    if (card === undefined) {
        // This will always happen for GMs, who don't gain xp.
        // It may also happen if no cards left in reserve or xp of this suit.
        return false;
    }
    card.xp = card.xp + 1;
    if (card.xp >= card.max_xp) {
        // A card has gained enough xp to be added to the deck! Move it directly to hand.
        card.location = "hand";
        // Find next card to add to xp pile. This may not exist, if player just drew highest card in suit.
        const next_card = next_card_in_suit(deck, suit, card.value);
        if (next_card !== undefined) {
            next_card.location = "xp";
        }
        // Return true to indicate a card was drawn to hand.
        return true;
    }
    return false;
}

// Cut down a list of card indeces to those that match a property.
function card_ids_that_match_prop(
    deck,
    property_type,
    property_name,
    all_card_ids
) {
    //if no card ids are specified, it will go through every card in the deck
    if (all_card_ids === undefined || all_card_ids.length == 0) {
        all_card_ids = [];
        for (i = 0; i < deck.cards.length; i++) {
            all_card_ids.push(i);
        }
    }

    // compare, based on which property was selected
    const matching_indeces = [];
    const prop = property_type.toLowerCase();
    for (i = 1; i < all_card_ids.length; i++) {
        if (deck.cards[i][prop] == property_name) {
            matching_indeces.push(i);
        }
    }
    return matching_indeces;
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

function is_valid_card(value, suit) {
    return (
        (possible_values()).includes(value.toLowerCase()) &&
        (possible_suits()).includes(suit.toLowerCase())
    );
}

function cards_in_location(deck, location) {
    return deck.cards.filter((card) => card.location == location);
}

function possible_locations() {
    return ['hand','deck','xp','discard','lost','reserve','swap','destroyed'];
}

function possible_values() {
    return ['a','2','3','4','5','6','7','8','9'];
}

function possible_suits() {
    return ['clubs','spades','diamonds','hearts'];
}

/**
 * Returns the first card in the deck with the specfied suit,
 * and the next highest value.
 * If no such card exists, returns `undefined`.
 * @param deck deck
 * @param string suit
 * @param string value
 */
function next_card_in_suit(deck, suit, value) {
    let next_value = NaN;
    if (value.toLowerCase() == "a") {
        next_value = "2";
    } else {
        const next_number = Number(value) + 1;
        next_value = String(next_number);
    }
    return deck.cards.find(
        (card) =>
            card.suit.toLowerCase() == suit.toLowerCase() &&
            card.value.toLowerCase() == next_value.toLowerCase()
    );
}

function draw_cards(deck, number) {
    let drawable = cards_in_location(deck, "deck");
    if (number > drawable.length) {
        throw new Error("Not enough cards to do that, you should reshuffle.");
    }
    let drawn = [];
    for (let i = 0; i < number; i++) {
        let index = Math.floor(Math.random() * drawable.length);
        const removed_cards = drawable.splice(index, 1);
        const card = removed_cards[0];
        drawn.push(card);
    }
    return drawn;
}

function clean_swap(mygame, sender_deckid, recipient_deckid, sw_card) {
    let original_card_copy = mygame.decks[sender_deckid].cards.filter(card => ( (card.value == sw_card.value) && (card.suit == sw_card.suit) ));
    console.log(original_card_copy);
    let original_card_index = mygame.decks[sender_deckid].cards.indexOf(original_card_copy[0]);
    console.log(original_card_index);
    mygame.decks[sender_deckid].cards[original_card_index].location = 'discard';
    // delete temporary swapped card
    mygame.decks[recipient_deckid].cards.splice(mygame.decks[recipient_deckid].cards.indexOf(sw_card));
    return;
} // the played card was previously swapped

module.exports = {
    card,
    deck,
    Praxisgame,
    add_answer,
    card_ids_that_match_prop,
    cards_in_location,
    clean_swap,
    create_praxis,
    draw_cards,
    find_cards_in_location,
    find_deck_id,
    gain_exp,
    is_valid_card,
    next_card_in_suit,
    possible_locations,
    possible_suits,
    possible_values,
    show_cards_in_zone
};
