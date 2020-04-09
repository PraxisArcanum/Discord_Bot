// Stuff to implement later: max hand size

module.exports = {
    name: 'check',
    description: 'Draws cards from a deck then replaces them',
    execute(message, args, deck,embed){
        let indexpulled = 0; // defining it here so that I can call it by [i] later
        let all_pulled = [];

        // Make sure there are cards to draw
        if (args.length < 2){
            num_to_draw = 1;
        } else {
            num_to_draw = args[1];
        }

        let somethingtodraw = 0;
        for (let i = 0; i < deck.cards.length; i++){
            somethingtodraw += (deck.cards[i].location == 'deck'); //so long as there are cards in the deck...
        }
        if (somethingtodraw < num_to_draw){
            message.channel.send('Not enough cards left to do a check, you should reshuffle');
            return;
        }

        // Get a random card index (0:length) and make sure it's in the deck
        for (i = 0; i<num_to_draw; i++){
            indexpulled = Math.floor( Math.random() * (deck.cards.length));
            while (deck.cards[indexpulled].location != 'deck'){
                indexpulled = Math.floor( Math.random() * (deck.cards.length));
            }
            all_pulled.push(indexpulled);
            console.log('Pulled card number ' + indexpulled);
            message.channel.send('Pulled the '+deck.cards[indexpulled].value + ' of ' + deck.cards[indexpulled].suit);
        }

        embed.setTitle('Your '+deck.role + ' check')
        embed.setColor(0xF1C40F);
        
        for (let i = 0; i<num_to_draw; i++){
            embed.addField('Card', (deck.cards[all_pulled[i]].value + ' of ' + deck.cards[all_pulled[i]].suit),true)
            embed.addField('Praxis', (deck.cards[all_pulled[i]].praxis),true)
            embed.addField('\u200B','\u200B',true);
        }

        message.channel.send(embed);

        // These cards all stay in the deck
    }
}