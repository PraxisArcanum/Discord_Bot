// Stuff to implement later: max hand size
const Deck = require('../deckHelpers.js');

module.exports = {
    name: 'check',
    description: 'Draws cards from a deck then replaces them',
    execute(message, args, deck, embed, lastcheck){
        // Make sure there are cards to draw
        if (args.length < 2){
            num_to_draw = 3; // default check is 3
        } else {
            num_to_draw = args[1];
        }

        // Randomly select the correct number of cards.
        let drawn_cards = [];
        try {
            drawn_cards = Deck.draw_cards(deck, num_to_draw);
        } catch (e) {
            // Show the error message and abort if something goes wrong.
            message.channel.send(e.message);
            return;
        }
        
        // Prepare the embed.
        embed.setTitle('Your '+ deck.role + ' check')
        embed.setColor(0xF1C40F);
        
        for(let i=0; i < drawn_cards.length; i++) {
            const card = drawn_cards[i];

            // Send a message about individual card.
            message.channel.send('Pulled the ' + card.name());

            // Add card to embed to show at end.
            embed.addField('Card', card.name(),true);
            embed.addField('Praxis', card.praxis,true);
            embed.addField('\u200B','\u200B',true);
        }

        message.channel.send(embed);
        lastcheck = embed;
    }
}