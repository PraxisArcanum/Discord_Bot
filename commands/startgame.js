module.exports = {
    name: 'startgame',
    description: 'starts a new game of Praxis!',
    execute(message, args){
        console.log('New game initiated');
        var game = {
            Decks: {
                GMdeck:{
                    cards:[]
                },
                Playerdeck:{
                    cards:[]
                }
            },
            Players: " ",
            ID: "P_0001"
        }
        message.channel.send('Your game ID is ' + game.ID);
        return game
    }
}