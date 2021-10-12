const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const opts = { toJSON: { virtuals: true } };

const PlayerSchema = new Schema({
    hand: [],
    money: Number,
    doneDiscarding: Boolean,
    isAI: Boolean,
    difficulty: String,
    name: String,
    icon: String,
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

const ResearchLineCardSchema = new Schema({
    letter: String,
    bets: [],
    ledger: Number,
    stackSize: Number
});

const GameData = new Schema({
    currentDeck: [],
    bank: Number,
    activePlayer: Number,
    spellingPlayer: Number,
    newResearchLine: [ResearchLineCardSchema],
    discard: [],
    currentWord: [],
    currentWordReference: [],
    submitionIsAWord: Boolean,
    doneSelectingFromHand: Boolean,
    doneSelectingF: Boolean,
    selectedFromHand: [],
    discardFromHand: [],
    temporaryF: Number,
    mDealtToResearchLine: Number,
    selectedToDiscard: Number,
    everyonesDiscarded: Boolean,
    lastRound: Boolean,
    actingOn: String,
    randomBettingLetter: Number,
    bestChoice: {},
    inLobby: Boolean,
    nameList: [],
    players: [PlayerSchema]
}, opts);

GameData.virtual('allBets').get(function () {
    var allBets = [];
    for (var i = 0; i < this.newResearchLine.length; i++) {
        //allBets[i] = this.players[0].bets[i] + this.players[1].bets[i] + this.players[2].bets[i] + this.players[3].bets[i];
        allBets.push(0);
        for(var j = 0; j < this.players.length; j++) {
            allBets[i] += this.newResearchLine[i].bets[j];
        }
    }
    return allBets;
});

module.exports = mongoose.model('gameData', GameData);