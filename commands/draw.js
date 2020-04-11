// Stuff to implement later: max hand size

module.exports = {
    name: 'draw',
    description: 'Draws a card from a deck',
    execute(message, args, deck){
        // Make sure there are cards to draw
        let somethingtodraw = 0;
        for (let i = 0; i < deck.cards.length; i++){
            somethingtodraw += (deck.cards[i].location == 'deck'); //so long as there are cards in the deck...
        }
        if (somethingtodraw < 1){
            message.channel.send('Nothing left to draw, you should reshuffle');
            return;
        }

        // Get a random card index (0:length) and make sure it's in the deck
        let indexpulled = Math.floor( Math.random() * (deck.cards.length));
        while (deck.cards[indexpulled].location != 'deck'){
            // TODO: This can be made more efficient.
            indexpulled = Math.floor( Math.random() * (deck.cards.length));
        }
        console.log('Drew card number ' + indexpulled);
        message.channel.send('Drew the '+deck.cards[indexpulled].value + ' of ' + deck.cards[indexpulled].suit);

        // Set the new location of that card to be in hand
        console.log(deck.cards[indexpulled].location);
        deck.cards[indexpulled].location = 'hand';
        console.log(deck.cards[indexpulled].location);

    }
}