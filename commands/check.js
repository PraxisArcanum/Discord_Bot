// Stuff to implement later: max hand size

module.exports = {
    name: 'check',
    description: 'Draws cards from a deck then replaces them',
    execute(message, args, deck, embed){
        let indexpulled = 0; // defining it here so that I can call it by [i] later
        let all_pulled = [];

        // Make sure there are cards to draw
        if (args.length < 2){
            num_to_draw = 3; // default check is 3
        } else {
            num_to_draw = args[1];
        }

        // Get a random card index (0:length) and make sure it's in the deck
        for (i = 0; i<num_to_draw; i++){

            let cardstodraw = deck.cards.filter(card => card.location == 'deck');
            if (cardstodraw.length < num_to_draw){
                message.channel.send('Not enough cards left to do a check, you should reshuffle');
                return;
            }
            indexpulled = Math.floor( Math.random() * (cardstodraw)); // the index for cardstodraw
            card_drawn_index = deck.cards.findIndex(card => card == cardstodraw[indexpulled]); // the index for deck

            all_pulled.push(card_drawn_index);
            deck.cards[card_drawn_index].location = 'check';
            message.channel.send('Pulled the ' + deck.cards[card_drawn_index].value + ' of ' + deck.cards[card_drawn_index].suit);
        }

        embed.setTitle('Your '+ deck.role + ' check')
        embed.setColor(0xF1C40F);
        
        for (let i = 0; i<num_to_draw; i++){
            embed.addField('Card', (deck.cards[all_pulled[i]].value + ' of ' + deck.cards[all_pulled[i]].suit),true)
            embed.addField('Praxis', (deck.cards[all_pulled[i]].praxis),true)
            embed.addField('\u200B','\u200B',true);
            deck.cards[card_drawn_index].location = 'deck';
        }

        message.channel.send(embed);

        // These cards all stay in the deck
    }
}