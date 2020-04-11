// Stuff to implement later: max hand size
const Deck = require('../deckHelpers.js');

module.exports = {
    name: 'draw',
    description: 'Draws a card from a deck',
    execute(message, args, deck){
        // Make sure there are cards to draw
        const drawn_cards = Deck.drawn_cards(deck, 1);
        for(let i=0; i < drawn_cards.length; i++) {
            const card = drawn_cards[i];
            // Set the new location of that card to be in hand
            card.location = 'hand';
            console.log('Drew the ' + card.name() + ' from deck to hand.');
            message.channel.send('Drew the ' + card.name());
        }
    }
}