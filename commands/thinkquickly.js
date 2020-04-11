// Stuff to implement later: max hand size
const Deck = require('../deckHelpers.js');

module.exports = {
    name: 'thinkquickly',
    description: 'Draws a card from the deck, plays it to the current check, sends the card to discard',
    execute(message, deck, curr_game){

        // Make sure there are cards to draw
        num_to_draw = 1; // default check is 1

        // Randomly select the correct number of cards.
        let drawn_cards = [];
        try {
            drawn_cards = Deck.draw_cards(deck, num_to_draw);
        } catch (e) {
            // Show the error message and abort if something goes wrong.
            message.channel.send(e.message);
            return;
        }
        
        for(let i=0; i < drawn_cards.length; i++) {
            const card = drawn_cards[i];

            // Send a message about individual card.
            message.channel.send('Thinking quickly added the ' + card.name());
            card.location = 'discard';

            // Add card to embed to show at end.
            curr_game.lastcheck.addField(message.author.username + '\'s Thinking Quickly', card.name(),true);
            curr_game.lastcheck.addField('Praxis', card.praxis,true);
            curr_game.lastcheck.addField('\u200B','\u200B',true);
        }

        message.channel.send(curr_game.lastcheck);

        // These cards all stay in the deck
    }
}