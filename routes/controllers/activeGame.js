var scrabble = require('scrabble');
var gameContents = require('../../gameBox/contents');
const gameData = require('../../models/gameData');
const GameData = require('../../models/gameData');
const Shuffle = require('../../utils/shuffle');

module.exports.debugChangeController = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const toChange = req.body.player;
    gameData.players[toChange].isAI = !gameData.players[toChange].isAI;
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
    return;
}

module.exports.debugDealResearchLine = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const key = req.body.letter;
    const primaryLocation = key[0];
    const newCard = key[1];
    const indexLocation = key[2];
    const indexToDebug = indexLocation;
    if(primaryLocation == 'r') {
        gameData.newResearchLine[indexToDebug].stackSize = 0;
        gameData.currentDeck.splice(0, 0, newCard);
        gameData = refillResearchLine(gameData, indexToDebug);
    }
    if(primaryLocation == 'h'){
        gameData.players[gameData.activePlayer].hand[indexToDebug] = newCard;
    }

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
    return;
}

module.exports.confirmDiscard = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id).populate('player');
    for(var i = 0; i < gameData.players[gameData.activePlayer].hand.length; i++) {
        if(gameData.discardFromHand[i]) {
            gameData.discard.push(gameData.players[gameData.activePlayer].hand.splice(i, 1)[0]);
        }
    }
    gameData.players[gameData.activePlayer].doneDiscarding = true;

    gameData.everyonesDiscarded = true;
    for(var i = 0; i < gameData.players.length; i++) {
        if(!gameData.players[i].doneDiscarding){
            gameData.everyonesDiscarded = false;
            break;
        }
    }
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}/changeActivePlayer`);
}

module.exports.undoDiscard = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    gameData.selectedToDiscard = 0;
    gameData.discardFromHand = [];
    for(var i = 0; i < gameData.players[gameData.activePlayer].hand.length; i++) {
        gameData.discardFromHand.push(false);
    }
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.discardFromHand = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var index = req.params.selectedIndex;
    if(gameData.discardFromHand[index]){
        gameData.selectedToDiscard--;
    }
    else {
        gameData.selectedToDiscard++;
    }
    gameData.discardFromHand[index] = !gameData.discardFromHand[index];
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.writersBlock = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var numberDiscarded = 0;
    //discard hand
    while(gameData.players[gameData.spellingPlayer].hand.length > 0) {
        gameData.discard.push(gameData.players[gameData.spellingPlayer].hand.shift());
        numberDiscarded++;
    }
    //draw the number of cards discarded
    while (gameData.players[gameData.spellingPlayer].hand.length < numberDiscarded) {
        if(gameData.currentDeck.length < 1){
            gameData = refillDeck(gameData);
        }
        gameData.players[gameData.spellingPlayer].hand.push(gameData.currentDeck.shift());
    }

    //unselect all cards
    for(var i = 0; i < gameData.selectedFromHand.length; i++) {
        gameData.selectedFromHand[i] = false;
    }

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.skipTurn = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    //refund bets
    var amountBet = 0;
    for(var i = 0; i < gameData.players.length; i++) {
        for(var j = 0; j < gameData.newResearchLine.length; j++) {
            amountBet += gameData.newResearchLine[j].bets[i];
            gameData.newResearchLine[j].bets[i] = 0;
        }
        gameData.players[i].money += amountBet;
        amountBet = 0;
    }
    
    //discard hand
    while(gameData.players[gameData.spellingPlayer].hand.length > 0) {
        gameData.discard.push(gameData.players[gameData.spellingPlayer].hand.shift());
    }

    console.log(gameData.currentWordReference);
    console.log(gameData.newResearchLine);

    //empty currentWordReference and put cards back onto the researchLine
    while (gameData.currentWordReference.length > 0) {
        var nextItem = [...gameData.currentWordReference.shift()];
        if(nextItem[0] == 'r'){
            //it's from the research line
            gameData.newResearchLine[nextItem[nextItem.length - 1]].stackSize++;
        }
    }
    //empty currentWord
    gameData.currentWord = [];
    gameData.selectedFromHand = [false, false, false];

    //'X' rule: At the start of your turn, place 2c onto this Letter.
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        if(gameData.newResearchLine[i].letter == "X"){
            gameData.newResearchLine[i].ledger += 2;
        }
    }

    //add 1c to the rest of the Ledgers
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        gameData.newResearchLine[i].ledger++;
        gameData.bank--;
    }

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);

    //redeal a new hand of 3
    await dealNewHand(gameData._id, gameData.spellingPlayer);

    //change the spelling player to the next player (also change the active player to the next player)
    await changeTurns(gameData._id);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.submitHandCards = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    gameData.doneSelectingFromHand = true;
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}/changeActivePlayer`);
}

module.exports.selectFromHand = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var index = req.params.selectedIndex;
    gameData.selectedFromHand[index] = !gameData.selectedFromHand[index];
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.confirmF = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);

    gameData.doneSelectingF = true;
    gameData.temporaryF = -1;

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.undoF = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);

    //gameData.ledger[gameData.temporaryF]--;
    gameData.newResearchLine[gameData.temporaryF].ledger--;
    gameData.temporaryF = -1;

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.addF = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var selectedIndex = req.params.selectedIndex;

    gameData.temporaryF = selectedIndex;
    gameData.newResearchLine[selectedIndex].ledger++;
    gameData.doneSelectingF = false;

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.undoBet = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var amountBet = 0;
    // for(var i = 0; i < gameData.players[gameData.activePlayer].bets.length; i++) {
    //     amountBet += gameData.players[gameData.activePlayer].bets[i];
    //     gameData.players[gameData.activePlayer].bets[i] = 0;
    // }
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        amountBet += gameData.newResearchLine[i].bets[gameData.activePlayer];
        gameData.newResearchLine[i].bets[gameData.activePlayer] = 0;
    }
    gameData.players[gameData.activePlayer].money += amountBet;
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    
    res.redirect(`/game/${gameData._id}`);
}

module.exports.addBet = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var selectedIndex = req.params.selectedIndex;

    if(gameData.players[gameData.activePlayer].money > 0) {
        //make sure that if the letter they are betting on is a vowel, their bet isn't exceeding the maximum
        var letter = gameData.newResearchLine[selectedIndex].letter;
        if(letter == 'A' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'){
            var currentLedger = gameData.newResearchLine[selectedIndex].ledger;
            var currentBet = 0;
            for(var i = 0; i < gameData.players.length; i++) {
                currentBet += gameData.newResearchLine[selectedIndex].bets[i];
            }
            if(currentBet == (currentLedger + 1)) {
                //too high, do nothing
            } else {
                //the bet isn't at it's maximum, allow them to bet more on this letter
                gameData.players[gameData.activePlayer].money--;
                gameData.newResearchLine[selectedIndex].bets[gameData.activePlayer]++;
            }                        
        } else {
            gameData.players[gameData.activePlayer].money--;
            gameData.newResearchLine[selectedIndex].bets[gameData.activePlayer]++;
        }
    }
    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    
    res.redirect(`/game/${gameData._id}`);
}

module.exports.addOrRemoveLetterFromWord = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var selectedIndex = req.params.selectedIndex;
    var indexInCurrentWord = -1;
    if(!(selectedIndex[0] === 'h' || selectedIndex[0] === 'r')) {
        //the user clicked on a card in the word to remove it (selectedIndex starts as a number here, then becomes a string)
        indexInCurrentWord = selectedIndex;
        selectedIndex = gameData.currentWordReference[selectedIndex];
    } else {
        //the user clicked on an empty space in the hand/research line to remove it (selectedIndex is a string here)
        indexInCurrentWord = gameData.currentWordReference.indexOf(selectedIndex);
    }

    var indexToAdd = [...selectedIndex];
    if(indexToAdd[0] === 'r'){
        if(gameData.newResearchLine[indexToAdd[indexToAdd.length - 1]].stackSize > 0){
            //if the there are still letters on the stack, add one to the word
            gameData.newResearchLine[indexToAdd[indexToAdd.length - 1]].stackSize--;
            gameData.currentWordReference.push(selectedIndex);
            gameData.currentWord.push(gameData.newResearchLine[indexToAdd[indexToAdd.length - 1]].letter);
        } else {
            //if there are no more letters on the stack, return all the letters from the word onto the stack
            for(var i = 0; i < gameData.currentWord.length; i++) {
                if(gameData.currentWordReference[i] == selectedIndex){
                    gameData.currentWordReference.splice(i, 1);
                    gameData.currentWord.splice(i, 1);
                    i--;
                    gameData.newResearchLine[indexToAdd[indexToAdd.length - 1]].stackSize++;
                }
            }
        }
    }
    else if (indexInCurrentWord > -1) {
        //it found it already in the current word, so it must be removed
        gameData.currentWordReference.splice(indexInCurrentWord, 1);
        gameData.currentWord.splice(indexInCurrentWord, 1);
    } else {
        // it was NOT found, so must be addeded
        gameData.currentWordReference.push(selectedIndex);
        if(indexToAdd[0] === 'h'){
            //we're looking at a card from the hand.  Add that letter
            gameData.currentWord.push(gameData.players[gameData.spellingPlayer].hand[indexToAdd[indexToAdd.length - 1]]);
        } else {
            //we're looking at a card from the research line.  Add that letter
            gameData.currentWord.push(gameData.newResearchLine[indexToAdd[indexToAdd.length - 1]].letter);
        }
    }
    await gameData.save();
    res.redirect(`/game/${gameData._id}`);
}

module.exports.cleanUpPhase = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    gameData.bestChoice = {};

    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        if(gameData.currentWordReference.includes(`researchLine${i}`)){
            var numberOfTimesToPay = 0;
            for(var x = 0; x < gameData.currentWordReference.length; x++) {
                if(gameData.currentWordReference[x] == `researchLine${i}`){
                    numberOfTimesToPay++;
                }
            }
            //pay opponents who bet
            for(var j = gameData.spellingPlayer + 1; j != gameData.spellingPlayer; j++) {
                //use this to do payments starting with the player on the left, incase the speller runs out of money
                if(j == gameData.players.length){
                    j = 0;
                    if(j == gameData.spellingPlayer) {
                        break;
                    }
                }
                //opponent gets their bet back
                gameData.players[j].money += gameData.newResearchLine[i].bets[j];

                //opponent is paid by the spelling player (if possible)
                if(gameData.players[gameData.spellingPlayer].money < (numberOfTimesToPay * gameData.newResearchLine[i].bets[j]) || gameData.players[gameData.spellingPlayer].money == 0){
                    //the spelling player doesn't have enough money to pay this player
                    gameData.players[j].money += gameData.players[gameData.spellingPlayer].money;
                    gameData.players[gameData.spellingPlayer].money = 0;
                    //break;
                } else {
                    //the spelling player does have enough money to pay this player
                    gameData.players[j].money += (numberOfTimesToPay * gameData.newResearchLine[i].bets[j]);
                    gameData.players[gameData.spellingPlayer].money -= (numberOfTimesToPay * gameData.newResearchLine[i].bets[j]);
                }
                gameData.newResearchLine[i].bets[j] = 0;
            }
        } else {
            //move unused bets to the Ledgers
            var thisTurnsBets = 0;
            for(var j = 0; j < gameData.players.length; j++) {
                thisTurnsBets += gameData.newResearchLine[i].bets[j];
                gameData.newResearchLine[i].bets[j] = 0;
            }
            //gameData.ledger[i] += thisTurnsBets;
            gameData.newResearchLine[i].ledger += thisTurnsBets;
            //add 1c to the rest of the Ledgers
            gameData.newResearchLine[i].ledger++;
            gameData.bank--;
        }
    }    

    //put all the used cards in the discard
    while (gameData.currentWord.length > 0) {
        gameData.discard.push(gameData.currentWord.shift());
    }
    for(var j = 0; j < gameData.currentWordReference.length; j++) {
        const wordReference = gameData.currentWordReference[j];
        const indexToAdd = [...wordReference];
        if(indexToAdd[0] === 'h'){
            //it's a card from the hand
            for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++) {
                if(indexToAdd[indexToAdd.length - 1] == i) {
                    //kinda awkward place to do this, but discard that card... from the hand
                    gameData.players[gameData.spellingPlayer].hand.splice(i, 1);
                    break;
                }
            }
        }
    }

    //fill the player's hand back up to 3
    while (gameData.players[gameData.spellingPlayer].hand.length < 3) {
        if(gameData.currentDeck.length < 1){
            gameData = refillDeck(gameData);
        }
        gameData.players[gameData.spellingPlayer].hand.push(gameData.currentDeck.shift());
    }
    
    gameData = refillResearchLine(gameData, -1);
    
    while (gameData.currentWordReference.length > 0) {
        gameData.currentWordReference.shift();
    }

    //'X' rule: At the start of your turn, place 2c onto this Letter.
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        if(gameData.newResearchLine[i].letter == "X"){
            gameData.newResearchLine[i].ledger += 2;
        }
    }

    const _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);

    //change the spelling player to the next player (also change the active player to the next player)
    await changeTurns(gameData._id);
    res.redirect(`/game/${gameData._id}`);
}

const refillResearchLine = (gameData, specialCase) => {
    //refill the Research Line
    console.log("before refill....");
    console.log(gameData.newResearchLine);

    //'V' rule: At the start of your turn, fill the Research Line to 6.
    //Check how long the Research Line was at the end of the turn
    //5:    Fill it like normal, then check to see if there is a V. If there is, add a 6th card.
    //      That means adding a 6th element to gameData.newResearchLine
    //6:    If there is a V leftover, fill it like normal.  If there isn't a V leftover, find
    //      the index of first element in researchLine that was used in spelling the word, and
    //      remove (array.splice(index, 1)) the element from the newResearchLine at that index, then fill it like 5.
    var hasV = false;
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        if(gameData.newResearchLine[i].letter == 'V') {
            hasV = true;
        }
    }
    //if it had a 'V' last turn, but no longer has a 'V', then we need to reduce newResearchLine to a length of 5\
    if(hasV && gameData.newResearchLine.length == 6) {
        for(var i = 0; i < gameData.newResearchLine.length; i++) {
            if((gameData.newResearchLine[i].letter == 'V') && (gameData.newResearchLine[i].stackSize < 1)){
                //all the 'V''s were played, so remove that index
                gameData.newResearchLine.splice(i, 1);
            }
        }
    }
    
    //fill it like normal (if it doesn't have a 'V', or if still has the 'V' from last turn)
    if(!hasV || (hasV && gameData.newResearchLine.length == 6)) {
        for(var i = 0; i < gameData.newResearchLine.length; i++) {
            if((gameData.currentWordReference.includes(`researchLine${i}`)) || (specialCase == i)){
                var newCard = gameData.currentDeck.shift();
                var alreadyOnResearchLine = false;
                var index = i;
                for(var j = 0; j < gameData.newResearchLine.length; j++) {
                    if(gameData.newResearchLine[j].letter == newCard) {
                        alreadyOnResearchLine = true;
                        //it's a letter that's already on the line, so just add it to it's stack
                        gameData.newResearchLine[j].stackSize++;
                        //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                        if(newCard == 'B'){
                            if(index == 0) {
                                gameData.newResearchLine[gameData.newResearchLine.length - 1].ledger++;
                                gameData.newResearchLine[1].ledger++;
                            } else if (index == gameData.newResearchLine.length - 1) {
                                gameData.newResearchLine[0].ledger++;
                                gameData.newResearchLine[gameData.newResearchLine.length - 2].ledger++;
                            } else {
                                gameData.newResearchLine[index - 1].ledger++;
                                gameData.newResearchLine[index + 1].ledger++;
                            }
                            gameData.bank -= 2;
                        //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                        } else if(newCard == 'C'){
                            for(var j = 0; j < gameData.players.length; j++) {
                                if(gameData.currentDeck.length < 1){
                                    gameData = refillDeck(gameData);
                                }
                                gameData.players[j].hand.push(gameData.currentDeck.shift());
                            }
                        //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
                        } else if(newCard == 'M'){
                            gameData.mDealtToResearchLine++;
                        }
                    }
                }
                if(alreadyOnResearchLine){
                    //this is probably not the best, but reduce 'i' so as to not skip over the slot
                    i--;
                } else {
                    //it's a new unique letter
                    gameData.newResearchLine[i] = {
                        letter: newCard,
                        bets: [],
                        ledger: 0,
                        stackSize: 1
                    }
                    for(var j = 0; j < gameData.players.length; j++) {
                        gameData.newResearchLine[i].bets[j] = 0;
                    }
                    //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                    if(newCard == 'B'){
                        if(index == 0) {
                            gameData.newResearchLine[gameData.newResearchLine.length - 1].ledger++;
                            gameData.newResearchLine[1].ledger++;
                        } else if (index == gameData.newResearchLine.length - 1) {
                            gameData.newResearchLine[0].ledger++;
                            gameData.newResearchLine[gameData.newResearchLine.length - 2].ledger++;
                        } else {
                            gameData.newResearchLine[index - 1].ledger++;
                            gameData.newResearchLine[index + 1].ledger++;
                        }
                        gameData.bank -= 2;
                    //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'C'){
                        for(var j = 0; j < gameData.players.length; j++) {
                            if(gameData.currentDeck.length < 1){
                                gameData = refillDeck(gameData);
                            }
                            gameData.players[j].hand.push(gameData.currentDeck.shift());
                        }
                    //'M' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'M'){
                        gameData.mDealtToResearchLine++;
                    }
                }
            }
        }
    }
    //if there wasn't a leftover 'V'...
    if(gameData.newResearchLine.length < 6) {
        hasV = false;
        for(var i = 0; i < gameData.newResearchLine.length; i++) {
            if(gameData.newResearchLine[i].letter == 'V') {
                hasV = true;
            }
        }
        //and a new one was just added...
        if(hasV){
            //then deal one more card
            for(var i = 0; i < 1; i++){
                var newCard = gameData.currentDeck.shift();
                var alreadyOnResearchLine = false;
                var index = gameData.players.length - 1;
                for(var j = 0; j < gameData.newResearchLine.length; j++) {
                    if(gameData.newResearchLine[j].letter == newCard) {
                        alreadyOnResearchLine = true;
                        //it's a letter that's already on the line, so just add it to it's stack
                        gameData.newResearchLine[j].stackSize++;
                        //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                        if(newCard == 'B'){
                            if(index == 0) {
                                gameData.newResearchLine[gameData.newResearchLine.length - 1].ledger++;
                                setGameData.newResearchLine[1].ledger++;
                            } else if (index == gameData.newResearchLine.length - 1) {
                                gameData.newResearchLine[0].ledger++;
                                gameData.newResearchLine[gameData.newResearchLine.length - 2].ledger++;
                            } else {
                                gameData.newResearchLine[index - 1].ledger++;
                                gameData.newResearchLine[index + 1].ledger++;
                            }
                            gameData.bank -= 2;
                        //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                        } else if(newCard == 'C'){
                            for(var j = 0; j < gameData.players.length; j++) {
                                if(gameData.currentDeck.length < 1){
                                    gameData = refillDeck(gameData);
                                }
                                gameData.players[j].hand.push(gameData.currentDeck.shift());
                            }
                        //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
                        } else if(newCard == 'M'){
                            gameData.mDealtToResearchLine++;
                        }
                    }
                }
                if(alreadyOnResearchLine){
                    //this is probably not the best, but reduce 'i' so as to not skip over the slot
                    i--;
                } else {
                    gameData.newResearchLine.push({
                        letter: newCard,
                        bets: [],
                        ledger: 0,
                        stackSize: 1
                    });
                    for(var j = 0; j < gameData.players.length; j++) {
                        gameData.newResearchLine[gameData.newResearchLine.length - 1].bets[j] = 0;
                    }
                    //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                    if(newCard == 'B'){
                        if(index == 0) {
                            gameData.newResearchLine[gameData.newResearchLine.length - 1].ledger++;
                            gameData.newResearchLine[1].ledger++;
                        } else if (index == gameData.newResearchLine.length - 1) {
                            gameData.newResearchLine[0].ledger++;
                            gameData.newResearchLine[gameData.newResearchLine.length - 2].ledger++;
                        } else {
                            gameData.newResearchLine[index - 1].ledger++;
                            gameData.newResearchLine[index + 1].ledger++;
                        }
                        gameData.bank -= 2;
                    //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'C'){
                        for(var j = 0; j < gameData.players.length; j++) {
                            if(gameData.currentDeck.length < 1){
                                gameData = refillDeck(gameData);
                            }
                            gameData.players[j].hand.push(gameData.currentDeck.shift());
                        }
                    //'M' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'M'){
                        gameData.mDealtToResearchLine++;
                    }
                }
            }
        }
    }
    console.log("after refill....");
    console.log(gameData.newResearchLine);
    return gameData;
}

const paySpeller = async (id) => {
    const LETTER_VALUE_3 = 3;
    const LETTER_VALUE_4 = 4;
    const LETTER_VALUE_5 = 7;
    const LETTER_VALUE_6 = 10;
    const LETTER_VALUE_7 = 15;
    const LETTER_VALUE_8 = 30;
    var gameData = await GameData.findById(id);

    //'W' rule: When you used in a word, any double letters count as an additional Card for the Word Value.
    var numberOfWs = 0;
    var extraValueFromWs = 0;
    for(var i = 0; i < gameData.currentWord.length; i++) {
        if(gameData.currentWord[i] == "W"){
            numberOfWs++;
        }
    }
    if(numberOfWs > 0) {
        var numberOfDoubles = 0;
        var alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
        for(var i = 0; i < alphabet.length; i++) {
            var numberOfThisLetter = 0;
            for(var j = 0; j < gameData.currentWord.length; j++) {
                if ((gameData.currentWord[j] == alphabet[i]) || (gameData.currentWord[j] == alphabet[i].toUpperCase())){
                    numberOfThisLetter++;
                }
            }
            if(numberOfThisLetter >= 2){
                numberOfDoubles++;
            }   
        }
        extraValueFromWs = numberOfWs * numberOfDoubles;
    }

    var effectiveNumberOfLetters = gameData.currentWord.length + extraValueFromWs;
    //pay the Speller based on how many letters were in the word
    if(effectiveNumberOfLetters === 3) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_3;
        gameData.bank -= LETTER_VALUE_3;
    } else if(effectiveNumberOfLetters === 4) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_4;
        gameData.bank -= LETTER_VALUE_4;
    } else if(effectiveNumberOfLetters === 5) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_5;
        gameData.bank -= LETTER_VALUE_5;
    } else if(effectiveNumberOfLetters === 6) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_6;
        gameData.bank -= LETTER_VALUE_6;
    } else if(effectiveNumberOfLetters === 7) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_7;
        gameData.bank -= LETTER_VALUE_7;
    } else if(effectiveNumberOfLetters === 8) {
        gameData.players[gameData.spellingPlayer].money += LETTER_VALUE_8;
        gameData.bank -= LETTER_VALUE_8;
    }

    //'D' rule: When you use this Letter in a word, if it is the final Letter, Gain 1c from the Bank.
    if(gameData.currentWord[gameData.currentWord.length - 1] == 'D') {
        gameData.players[gameData.spellingPlayer].money++;
        gameData.bank--;
    }

    //'G' rule: When you use this Letter in a word, if it is the first Letter, Gain 1c from the Bank.
    if(gameData.currentWord[0] == 'G') {
        gameData.players[gameData.spellingPlayer].money++;
        gameData.bank--;
    }

    //'H' rule: When you use this Letter in a word, if it is the first or last Letter, Gain 1c from the Bank.
    if((gameData.currentWord[0] == 'H') || (gameData.currentWord[gameData.currentWord.length - 1] == 'H')) {
        gameData.players[gameData.spellingPlayer].money++;
        gameData.bank--;
    }

    //'K' rule: When you use this Letter in a word, if it is not immediately after a C, Gain 2c from the Bank.
    for(var i = 0; i < gameData.currentWord.length; i++) {
        if(gameData.currentWord[i] == 'K') {
            if(i == 0){
                gameData.players[gameData.spellingPlayer].money += 2;
                gameData.bank -= 2;
            } else if(gameData.currentWord[i - 1] != 'C') {
                gameData.players[gameData.spellingPlayer].money += 2;
                gameData.bank -= 2;
            }
        }
    }

    //'P' rule: When you use this Letter in the center of a word, Gain 2c from the Bank.
    var center = -1;
    if(gameData.currentWord.length % 2 != 0){
        //it's odd, there is 1 center
        center = (gameData.currentWord.length - 1) / 2;
        if(gameData.currentWord[center] == 'P'){
            gameData.players[gameData.spellingPlayer].money += 2;
            gameData.bank -= 2;
        }
    } else {
        //it's even, there are 2 centers
        center = gameData.currentWord.length / 2;
        if(gameData.currentWord[center] == 'P'){
            gameData.players[gameData.spellingPlayer].money += 2;
            gameData.bank -= 2;
        }
        if(gameData.currentWord[center - 1] == 'P'){
            gameData.players[gameData.spellingPlayer].money += 2;
            gameData.bank -= 2;
        }
    }

    //'Y' rule: When you use this Letter in a word, if it functions as a consonant, gain 1c from the Bank.
    if(gameData.currentWord.includes('Y')){
        var hasNoOtherVowels = true;
        for(var i = 0; i < gameData.currentWord.length; i++){
            if(gameData.currentWord[i] == 'A' || gameData.currentWord[i] == 'a'
            || gameData.currentWord[i] == 'E' || gameData.currentWord[i] == 'e'
            || gameData.currentWord[i] == 'I' || gameData.currentWord[i] == 'i'
            || gameData.currentWord[i] == 'O' || gameData.currentWord[i] == 'o'
            || gameData.currentWord[i] == 'U' || gameData.currentWord[i] == 'u'){
                hasNoOtherVowels = false;
                break;
            }
        }
        if(!hasNoOtherVowels){
            gameData.players[gameData.spellingPlayer].money++;
            gameData.bank--;
        }
    }

    //speller collects any ledgers used
    for(var i = 0; i < gameData.newResearchLine.length; i++) {
        if(gameData.currentWordReference.includes(`researchLine${i}`)){
            gameData.players[gameData.spellingPlayer].money += gameData.newResearchLine[i].ledger;
            gameData.newResearchLine[i].ledger = 0;
        }
    }

    await gameData.save();
}

module.exports.submitSpelling = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const currentWordString = gameData.currentWord.join("").toLowerCase();
    const scrabbleSet = scrabble(currentWordString);
    if(scrabbleSet.includes(currentWordString)) {
        //the word submited is actually a word!
        gameData.submitionIsAWord = true;
        await gameData.save();
        await paySpeller(gameData._id);
    } else {
        //it isn't a word :(
        gameData.submitionIsAWord = false;
        //show an error
        req.flash('error', `That's not a word, try again.`);
        await gameData.save();
    }
    res.redirect(`/game/${gameData._id}`);
}

const changeTurns = async (id) => {
    var gameData = await GameData.findById(id);
    gameData.activePlayer = await getNewActivePlayer(id);
    gameData.spellingPlayer = gameData.activePlayer;
    gameData.submitionIsAWord = false;
    gameData.doneSelectingFromHand = false;
    gameData.selectedFromHand = [];
    gameData.discardFromHand = [];
    for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++) {
        gameData.selectedFromHand.push(false);
        gameData.discardFromHand.push(false);
    }
    await gameData.save();
}

const getNewActivePlayer  = async (id) => {
    var gameData = await GameData.findById(id);
    gameData.activePlayer++;
    if (gameData.activePlayer > (gameData.players.length - 1)) {
        gameData.activePlayer = 0;
    }
    return gameData.activePlayer;
}

module.exports.changeActivePlayer = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    gameData.activePlayer = await getNewActivePlayer(gameData._id);
    gameData.discardFromHand = [];
    gameData.selectedToDiscard = 0;
    for(var i = 0; i < gameData.players[gameData.activePlayer].hand.length; i++) {
        gameData.discardFromHand.push(false);
    }
    await gameData.save();
    res.redirect(`/game/${gameData._id}`);
}

const dealNewHand = async (id, whichPlayer) => {
    const MAX_HAND_SIZE = 3;
    var gameData = await GameData.findById(id);

    //draw back up to the max hand size (don't discard at the end of the turn)
    while (gameData.players[whichPlayer].hand.length < MAX_HAND_SIZE) {
        if(gameData.currentDeck.length < 1){
            gameData = refillDeck(gameData);
        }
        gameData.players[whichPlayer].hand.push(gameData.currentDeck.shift());
    }
    await gameData.save();
}

module.exports.getActiveGame = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    renderGame(req, res, next, gameData);
}

const getRandomInt = (max) => {
    return Math.floor(Math.random() * max);
}

const calculateWordLengthValue = (wordData) => {
    const LETTER_VALUE_3 = 3;
    const LETTER_VALUE_4 = 4;
    const LETTER_VALUE_5 = 7;
    const LETTER_VALUE_6 = 10;
    const LETTER_VALUE_7 = 15;
    const LETTER_VALUE_8 = 30;

    //'W' rule: When you used in a word, any double letters count as an additional Card for the Word Value.
    var numberOfWs = 0;
    var extraValueFromWs = 0;
    for(var i = 0; i < wordData.length; i++) {
        if(wordData[i] == "W"){
            numberOfWs++;
        }
    }
    if(numberOfWs > 0) {
        var numberOfDoubles = 0;
        var alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
        for(var i = 0; i < alphabet.length; i++) {
            var numberOfThisLetter = 0;
            for(var j = 0; j < wordData.length; j++) {
                if ((wordData[j] == alphabet[i]) || (wordData[j] == alphabet[i].toUpperCase())){
                    numberOfThisLetter++;
                }
            }
            if(numberOfThisLetter >= 2){
                numberOfDoubles++;
            }   
        }
        extraValueFromWs = numberOfWs * numberOfDoubles;
    }

    var effectiveNumberOfLetters = wordData.length + extraValueFromWs;
    //pay the Speller based on how many letters were in the word
    if(effectiveNumberOfLetters === 3) {
        return LETTER_VALUE_3;
    } else if(effectiveNumberOfLetters === 4) {
        return LETTER_VALUE_4;
    } else if(effectiveNumberOfLetters === 5) {
        return LETTER_VALUE_5;
    } else if(effectiveNumberOfLetters === 6) {
        return LETTER_VALUE_6;
    } else if(effectiveNumberOfLetters === 7) {
        return LETTER_VALUE_7;
    } else if(effectiveNumberOfLetters === 8) {
        return LETTER_VALUE_8;
    }
}

const calculateLetterEffects = (wordData) => {
    var letterValue = 0;
    var lettersUsed = [];
    //'D' rule: When you use this Letter in a word, if it is the final Letter, Gain 1c from the Bank.
    if(wordData[wordData.length - 1] == 'D') {
        letterValue++;
        lettersUsed.push('D');
    }

    //'G' rule: When you use this Letter in a word, if it is the first Letter, Gain 1c from the Bank.
    if(wordData[0] == 'G') {
        letterValue++;
        lettersUsed.push('G');
    }

    //'H' rule: When you use this Letter in a word, if it is the first or last Letter, Gain 1c from the Bank.
    if((wordData[0] == 'H') || (wordData[wordData.length - 1] == 'H')) {
        letterValue++;
        lettersUsed.push('H');
    }

    //'K' rule: When you use this Letter in a word, if it is not immediately after a C, Gain 2c from the Bank.
    for(var i = 0; i < wordData.length; i++) {
        if(wordData[i] == 'K') {
            if(i == 0){
                letterValue += 2;
            } else if(wordData[i - 1] != 'C') {
                letterValue += 2;
            }
            lettersUsed.push('K');
        }
    }

    //'P' rule: When you use this Letter in the center of a word, Gain 2c from the Bank.
    var center = -1;
    if(wordData.length % 2 != 0){
        //it's odd, there is 1 center
        center = (wordData.length - 1) / 2;
        if(wordData[center] == 'P'){
            letterValue += 2;
            lettersUsed.push('P');
        }
    } else {
        //it's even, there are 2 centers
        center = wordData.length / 2;
        if(wordData[center] == 'P'){
            letterValue += 2;
            lettersUsed.push('P');
        }
        if(wordData[center - 1] == 'P'){
            letterValue += 2;
            lettersUsed.push('P');
        }
    }

    //'Y' rule: When you use this Letter in a word, if it functions as a consonant, gain 1c from the Bank.
    if(wordData.includes('Y')){
        var hasNoOtherVowels = true;
        for(var i = 0; i < wordData.length; i++){
            if(wordData[i] == 'A' || wordData[i] == 'a'
            || wordData[i] == 'E' || wordData[i] == 'e'
            || wordData[i] == 'I' || wordData[i] == 'i'
            || wordData[i] == 'O' || wordData[i] == 'o'
            || wordData[i] == 'U' || wordData[i] == 'u'){
                hasNoOtherVowels = false;
                break;
            }
        }
        if(!hasNoOtherVowels){
            letterValue++;
            lettersUsed.push('Y');
        }
    }
    return {
        letterValue,
        lettersUsed
    }
}

const calculateLedgerValue = (wordData, gameData) => {
    var ledgerValue = 0;
    //speller collects any ledgers used
    for(var i = 0; i < gameData.newResearchLine.length; i++){
        for(var j = 0; j < wordData.length; j++){
            if(wordData[j].groupPulledFrom == "researchLine" && wordData[j].indexPulledFrom == i){
                ledgerValue += gameData.newResearchLine[i].ledger;
            }
        }
    }
    
    return ledgerValue;
}

const calculateExpectedPaymentToOpponents = (wordData, gameData) => {
    var debit = 0;
    for(var i = 0; i < gameData.newResearchLine.length; i++){
        for(var j = 0; j < wordData.length; j++){
            if(wordData[j].groupPulledFrom == "researchLine" && wordData[j].indexPulledFrom == i){
                //pay opponents who bet
                for(var x = gameData.spellingPlayer + 1; x != gameData.spellingPlayer; x++) {
                    //use this to do payments starting with the player on the left, incase the speller runs out of money
                    if(x == gameData.players.length){
                        x = 0;
                        if(x == gameData.spellingPlayer) {
                            break;
                        }
                    }
                    //opponent is paid by the spelling player
                    debit += gameData.newResearchLine[i].bets[x];
                }
            }
        }
    }
    return debit;
}

const calculatePotentialMoney = (wordData, gameData) => {
    //word length
    const wordLengthValue = calculateWordLengthValue(wordData.oldWord);    

    //ledgers
    const ledgerValue = calculateLedgerValue(wordData.formattedWord, gameData);

    //extra effects from letter rules
    const letterData = calculateLetterEffects(wordData.oldWord);
    const letterValue = letterData.letterValue;
    const lettersUsed = letterData.lettersUsed;

    //payment to opponents
    const payments = calculateExpectedPaymentToOpponents(wordData.formattedWord, gameData);
    return {
        wordLengthValue,
        ledgerValue,
        letterValue,
        lettersUsed,
        payments,
        total: wordLengthValue + ledgerValue + letterValue - payments
    }
}

const calculateAIAction = async (res, req, gameData) => {
    var action = `/game/${gameData._id}`;

    if(gameData.actingOn == `betting` && (gameData.activePlayer != gameData.spellingPlayer)){
        //chose a random letter to bet on
        if(gameData.randomBettingLetter == -1){
            gameData.randomBettingLetter = getRandomInt(gameData.newResearchLine.length - 1);
        }

        //bet X, where X = ((Ledger - Other Bets) / 2) + 1
        var betAmount = 0;
        var otherBets = 0;
        var exceedsVowelLimit = false;
        for(var i = 0; i < gameData.players.length; i++){
            if(i != gameData.activePlayer){
                otherBets += gameData.newResearchLine[gameData.randomBettingLetter].bets[i];
            }
        }
        betAmount = ((gameData.newResearchLine[gameData.randomBettingLetter].ledger - otherBets) / 2) + 1;
        betAmount = Math.round(betAmount);
        //if it's a vowel, add 1
        if( gameData.newResearchLine[gameData.randomBettingLetter].letter == `A` ||
            gameData.newResearchLine[gameData.randomBettingLetter].letter == `E` ||
            gameData.newResearchLine[gameData.randomBettingLetter].letter == `I` ||
            gameData.newResearchLine[gameData.randomBettingLetter].letter == `O` ||
            gameData.newResearchLine[gameData.randomBettingLetter].letter == `U`){
                betAmount++;
                //check to make sure the AI can add more to their bet (because of regulated vowels rule)
                var totalBetsOnVowel = 0;
                for(var i = 0; i < gameData.players.length; i++){
                    totalBetsOnVowel += gameData.newResearchLine[gameData.randomBettingLetter].bets[i];
                }
                if((betAmount >= (gameData.newResearchLine[gameData.randomBettingLetter].ledger + 1))
                    && (totalBetsOnVowel == gameData.newResearchLine[gameData.randomBettingLetter].ledger + 1)){
                    exceedsVowelLimit = true;
                }
            }
        if(gameData.newResearchLine[gameData.randomBettingLetter].bets[gameData.activePlayer] < betAmount && (gameData.players[gameData.activePlayer].money > 0) && !exceedsVowelLimit){
            action = `/game/${gameData._id}/addBet/${gameData.randomBettingLetter}`;
        }
        else {
            //click Done Betting when finished, or when out of money
            gameData.randomBettingLetter = -1;
            action = `/game/${gameData._id}/changeActivePlayer`;
        }
    } else if(gameData.actingOn == `spelling` && (gameData.activePlayer == gameData.spellingPlayer)){
        const ALLOWED_TO_ADAPT = false;
        if(ALLOWED_TO_ADAPT){
            //compile a list of all the letters we have available to spell with
            var availableLetters = [];
            var neccessaryLetters = [];
            var letterData = {};
            //get all the letters on the research line
            for(var i = 0; i < gameData.newResearchLine.length; i++) {
                for(var j = 0; j < gameData.newResearchLine[i].stackSize; j++){
                    letterData = {
                        letter: gameData.newResearchLine[i].letter,
                        indexPulledFrom: i,
                        groupPulledFrom: 'researchLine'
                    }
                    availableLetters.push(letterData);
                }
            }
            //get all the letters in hand
            for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++){
                letterData = {
                    letter: gameData.players[gameData.spellingPlayer].hand[i],
                    indexPulledFrom: i,
                    groupPulledFrom: 'hand'
                }
                //make a note of letters that we added from the hand
                for(var j = 0; j < neccessaryLetters.length; j++){
                    if(neccessaryLetters[j].letter == gameData.players[gameData.spellingPlayer].hand[i]){
                        neccessaryLetters[j].number++;
                    }else {
                        neccessaryLetters.push({
                            letter: gameData.players[gameData.spellingPlayer].hand[i],
                            number: 1
                        });
                    }
                }
                if(neccessaryLetters.length == 0){
                    neccessaryLetters.push({
                        letter: gameData.players[gameData.spellingPlayer].hand[i],
                        number: 1
                    });
                }
                availableLetters.push(letterData);
            }

            var searchQuery = '';
            for(var i = 0; i < availableLetters.length; i++){
                searchQuery += availableLetters[i].letter.toLowerCase();
            }

            //see what words we can spell with those letters
            var availableWords = scrabble(searchQuery);
            //words MUST be at least 3 letters long, so remove any that are shorter than that
            for(var i = 0; i < availableWords.length; i++){
                if(availableWords[i].length < 3){
                    availableWords.splice(i,1);
                    i--;
                }
            }
            //all the cards set aside from the hand MUST be used, so remove options that don't fit that requirement
            for(var i = 0; i < availableWords.length; i++){
                for(var j = 0; j < neccessaryLetters.length; j++){
                    if(availableWords[i].includes(neccessaryLetters[j].letter)){
                        var splitWord = [...availableWords[i]];
                        var neccessaryNumber = 0;
                        for(var x = 0; x < splitWord.length; x++){
                            if(splitWord[x] == neccessaryLetters[j].letter){
                                neccessaryNumber++;
                            }
                        }
                        if(neccessaryNumber == neccessaryLetters.number){
                            //this is a valid option
                        } else{
                            //this is not a valid option and needs to be removed
                            availableWords.splice(i,1);
                            i--;
                        }
                    }
                }
            }
            //if there are no valid options, click 'skip turn'
            if(availableWords.length == 0){
                action = `/game/${gameData._id}/skipTurn`;
            } else{
                //get up to the 3 longest words we can spell, and compare them to see which will make us the most money
                //get up to the 3 longest words we can spell
                availableWords.sort((a, b) => b.length - a.length);
                console.log(availableWords);
                var bestChoices = [];
                for(var i = 0; (i < 3) && (i < availableWords.length); i++){
                    bestChoices.push(availableWords[i]);
                }
                //convert the word into the cards that will be used
                for(var i = 0; i < bestChoices.length; i++){
                    var formattedWord = [];
                    var oldWord = [...bestChoices[i]];
                    var checkingLetters = availableLetters.slice();
                    console.log("checkingLetters:");
                    console.log(checkingLetters);
                    console.log(`oldWord: ${oldWord.join('')}`);
                    for(var j = 0; j < oldWord.length; j++){
                        //check if a card from the hand can be used first
                        var letterUsed = false;
                        for(var x = 0; x < checkingLetters.length; x++){  
                            if((checkingLetters[x].groupPulledFrom == 'hand') && letterCompare(oldWord[j], checkingLetters[x].letter)){
                                //this letter in the word is this specific hand card, so this card should be played at that index
                                formattedWord.push(checkingLetters[x]);
                                checkingLetters.splice(x,1);
                                letterUsed = true;
                                console.log(formattedWord[formattedWord.length - 1]);
                                break;
                            }
                        }
                        if(!letterUsed){
                            for(var x = 0; x < checkingLetters.length; x++){
                                if ((checkingLetters[x].groupPulledFrom == 'researchLine') && letterCompare(oldWord[j], checkingLetters[x].letter)){
                                    //fill the rest up with cards from the research line
                                    formattedWord.push(checkingLetters[x]);
                                    checkingLetters.splice(x,1);
                                    letterUsed = true;
                                    console.log(formattedWord[formattedWord.length - 1]);
                                    break;
                                }
                            }
                        }
                    }
                    bestChoices[i] = {
                        oldWord: oldWord,
                        formattedWord: formattedWord
                    };
                }
                //compare them to see which will make us the most money
                mostMoney = {
                    money: -1,
                    index: -1
                }
                for(var i = 0; i < bestChoices.length; i++){
                    const potentialMoney = calculatePotentialMoney(bestChoices[i], gameData);
                    if(potentialMoney.total > mostMoney.money){
                        mostMoney.index = i;
                    }
                }
                bestChoice = bestChoices[mostMoney.index];

                //add specific information about what cards need to be set aside from the hand, if any
                var setAside = [];
                for(var i = 0; i < bestChoice.formattedWord.length; i++){
                    if(bestChoice.formattedWord[i].groupPulledFrom == 'hand'){
                        setAside.push(bestChoice.formattedWord[i].indexPulledFrom);
                    }
                }
                bestChoice.setAside = setAside;

                //save the selection of whatever word was chosen
                console.log(`Trying to spell '${bestChoice.oldWord.join('')}'`);
                gameData.bestChoice = bestChoice;
            }
        }
        if(gameData.bestChoice && (gameData.bestChoice.formattedWord.length > 0)){
            //spell the word by clicking the appropriate letters in order
            const from = gameData.bestChoice.formattedWord[0].groupPulledFrom;
            const index = gameData.bestChoice.formattedWord[0].indexPulledFrom;
            action = `/game/${gameData._id}/addLetter/${from}${index}`;
            gameData.bestChoice.formattedWord.splice(0,1);
        } else {
            //once the letter has been spelled, click 'submit'
            action = `/game/${gameData._id}/submitSpelling`;
            //gameData.bestChoice = {};
        }
    } else if(gameData.actingOn == `spellingCleanup` && (gameData.activePlayer == gameData.spellingPlayer)){
        action = `/game/${gameData._id}/cleanUpPhase`;
    } else if(gameData.actingOn == `selectFromHand` && (gameData.activePlayer == gameData.spellingPlayer)){
        //if the AI can click Writer's Block, have them click it.
        //check to make sure there is a vowel the player can use
        var hasVowel = false;
        for(var i = 0; i < gameData.newResearchLine.length; i++){
            var letter = gameData.newResearchLine[i].letter;
            if(letter == 'A' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'){
                hasVowel = true;
                break;
            }
        }
        if(!hasVowel){//no vowel on the research line, check the hand
            for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++){
                var letter = gameData.players[gameData.spellingPlayer].hand[i];
                if(letter == 'A' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'){
                    hasVowel = true;
                    break;
                }
            }
        }
        if(!hasVowel){
            action = `/game/${gameData._id}/writersBlock`;
        } else {
            //if there's already a word we've chosen to spell, skip the next 4 steps
            if(!(gameData.bestChoice)){
                //compile a list of all the letters we have available to spell with
                var availableLetters = [];
                var neccessaryLetters = [];
                var letterData = {};
                //get all the letters on the research line
                for(var i = 0; i < gameData.newResearchLine.length; i++) {
                    for(var j = 0; j < gameData.newResearchLine[i].stackSize; j++){
                        letterData = {
                            letter: gameData.newResearchLine[i].letter,
                            indexPulledFrom: i,
                            groupPulledFrom: 'researchLine'
                        }
                        availableLetters.push(letterData);
                    }
                }
                //get all the letters in hand
                for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++){
                    letterData = {
                        letter: gameData.players[gameData.spellingPlayer].hand[i],
                        indexPulledFrom: i,
                        groupPulledFrom: 'hand'
                    }
                    //make a note of letters that we added from the hand
                    for(var j = 0; j < neccessaryLetters.length; j++){
                        if(neccessaryLetters[j].letter == gameData.players[gameData.spellingPlayer].hand[i]){
                            neccessaryLetters[j].number++;
                        }else {
                            neccessaryLetters.push({
                                letter: gameData.players[gameData.spellingPlayer].hand[i],
                                number: 1
                            });
                        }
                    }
                    if(neccessaryLetters.length == 0){
                        neccessaryLetters.push({
                            letter: gameData.players[gameData.spellingPlayer].hand[i],
                            number: 1
                        });
                    }
                    availableLetters.push(letterData);
                }

                var searchQuery = '';
                for(var i = 0; i < availableLetters.length; i++){
                    searchQuery += availableLetters[i].letter.toLowerCase();
                }

                //see what words we can spell with those letters
                var availableWords = scrabble(searchQuery);
                //words MUST be at least 3 letters long, so remove any that are shorter than that
                for(var i = 0; i < availableWords.length; i++){
                    if(availableWords[i].length < 3){
                        availableWords.splice(i,1);
                        i--;
                    }
                }
                //all the cards set aside from the hand MUST be used, so remove options that don't fit that requirement
                for(var i = 0; i < availableWords.length; i++){
                    for(var j = 0; j < neccessaryLetters.length; j++){
                        if(availableWords[i].includes(neccessaryLetters[j].letter)){
                            var splitWord = [...availableWords[i]];
                            var neccessaryNumber = 0;
                            for(var x = 0; x < splitWord.length; x++){
                                if(splitWord[x] == neccessaryLetters[j].letter){
                                    neccessaryNumber++;
                                }
                            }
                            if(neccessaryNumber == neccessaryLetters.number){
                                //this is a valid option
                            } else{
                                //this is not a valid option and needs to be removed
                                availableWords.splice(i,1);
                                i--;
                            }
                        }
                    }
                }
                //if there are no valid options, click 'skip turn'
                if(availableWords.length == 0){
                    action = `/game/${gameData._id}/skipTurn`;
                } else{
                    //get up to the 3 longest words we can spell, and compare them to see which will make us the most money
                    //get up to the 3 longest words we can spell
                    availableWords.sort((a, b) => b.length - a.length);
                    console.log(availableWords);
                    var bestChoices = [];
                    for(var i = 0; (i < 3) && (i < availableWords.length); i++){
                        bestChoices.push(availableWords[i]);
                    }
                    //convert the word into the cards that will be used
                    for(var i = 0; i < bestChoices.length; i++){
                        var formattedWord = [];
                        var oldWord = [...bestChoices[i]];
                        var checkingLetters = availableLetters.slice();
                        console.log("checkingLetters:");
                        console.log(checkingLetters);
                        console.log(`oldWord: ${oldWord.join('')}`);
                        for(var j = 0; j < oldWord.length; j++){
                            //check if a card from the hand can be used first
                            var letterUsed = false;
                            for(var x = 0; x < checkingLetters.length; x++){  
                                if((checkingLetters[x].groupPulledFrom == 'hand') && letterCompare(oldWord[j], checkingLetters[x].letter)){
                                    //this letter in the word is this specific hand card, so this card should be played at that index
                                    formattedWord.push(checkingLetters[x]);
                                    checkingLetters.splice(x,1);
                                    letterUsed = true;
                                    console.log(formattedWord[formattedWord.length - 1]);
                                    break;
                                }
                            }
                            if(!letterUsed){
                                for(var x = 0; x < checkingLetters.length; x++){
                                    if ((checkingLetters[x].groupPulledFrom == 'researchLine') && letterCompare(oldWord[j], checkingLetters[x].letter)){
                                        //fill the rest up with cards from the research line
                                        formattedWord.push(checkingLetters[x]);
                                        checkingLetters.splice(x,1);
                                        letterUsed = true;
                                        console.log(formattedWord[formattedWord.length - 1]);
                                        break;
                                    }
                                }
                            }
                        }
                        bestChoices[i] = {
                            oldWord: oldWord,
                            formattedWord: formattedWord
                        };
                    }
                    //compare them to see which will make us the most money
                    mostMoney = {
                        money: -1,
                        index: -1
                    }
                    for(var i = 0; i < bestChoices.length; i++){
                        const potentialMoney = calculatePotentialMoney(bestChoices[i], gameData);
                        if(potentialMoney.total > mostMoney.money){
                            mostMoney.index = i;
                        }
                    }
                    bestChoice = bestChoices[mostMoney.index];

                    //add specific information about what cards need to be set aside from the hand, if any
                    var setAside = [];
                    for(var i = 0; i < bestChoice.formattedWord.length; i++){
                        if(bestChoice.formattedWord[i].groupPulledFrom == 'hand'){
                            setAside.push(bestChoice.formattedWord[i].indexPulledFrom);
                        }
                    }
                    bestChoice.setAside = setAside;

                    //save the selection of whatever word was chosen
                    console.log(`Trying to spell '${bestChoice.oldWord.join('')}'`);
                    gameData.bestChoice = bestChoice;
                }
            }
            if(gameData.bestChoice.setAside.length > 0){
                //set aside the cards by clicking the appropriate letters
                const index = gameData.bestChoice.setAside[0];
                action = `/game/${gameData._id}/selectFromHand/${index}`;
                gameData.bestChoice.setAside.splice(0,1);
            } else {
                //once the letter has been spelled, pass to betting
                action = `/game/${gameData._id}/submitHandCards`;
            }
        }
    } else if(gameData.actingOn == `mDealt`){
        //discard a card from hand for each M dealt
        while(!(gameData.selectedToDiscard == gameData.mDealtToResearchLine)){
            var index = req.params.selectedIndex;
            if(gameData.discardFromHand[index]){
                gameData.selectedToDiscard--;
            }
            else {
                gameData.selectedToDiscard++;
            }
            gameData.discardFromHand[index] = !gameData.discardFromHand[index];
        }
        for(var i = 0; i < gameData.players[gameData.activePlayer].hand.length; i++) {
            if(gameData.discardFromHand[i]) {
                gameData.discard.push(gameData.players[gameData.activePlayer].hand.splice(i, 1)[0]);
            }
        }
        gameData.players[gameData.activePlayer].doneDiscarding = true;
        gameData.everyonesDiscarded = true;
        for(var i = 0; i < gameData.players.length; i++) {
            if(!gameData.players[i].doneDiscarding){
                gameData.everyonesDiscarded = false;
                break;
            }
        }
        action = `/game/${gameData._id}/changeActivePlayer`;
        
        //pass the turn to the next player
    } else if(gameData.actingOn == 'fRule' && (gameData.activePlayer == gameData.spellingPlayer)){
        var selectedIndex = getRandomInt(gameData.newResearchLine.length);
        gameData.temporaryF = selectedIndex;
        gameData.newResearchLine[selectedIndex].ledger++;
        gameData.doneSelectingF = false;
        gameData.doneSelectingF = true;
        gameData.temporaryF = -1;
        action = `/game/${gameData._id}`;
    }

    gameData.actingOn = ``;
    var _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    //setTimeout(() => { res.redirect(action); }, 500);
    res.redirect(action);
}

const letterCompare = (a,b) => {
    return (a.toLowerCase() == b.toLowerCase());
}

const renderGame = async (req, res, next, gameData) => {
    if(gameData.inLobby){
        res.render('game/lobby', {gameData});
    }
    else{
        if(gameData.players[gameData.activePlayer].isAI && (gameData.actingOn != ``)){
            calculateAIAction(res, req, gameData);
        }
        else {
            if(gameData.bank <= 0){
                gameData.lastRound = true;
                const _id = req.params.id;
                await GameData.replaceOne({_id}, gameData);
            }
            if(gameData.lastRound && gameData.spellingPlayer == 0 && !gameData.doneSelectingFromHand) {
                //the game is over
                var winner = 0;
                for(var i = 0; i < gameData.players.length; i++) {
                    if(gameData.players[i].money > gameData.players[winner].money) {
                        winner = i;
                    }
                }
                // var winners = [];
                // for(var i = 0; i < gameData.players.length; i++) {
                //     if(gameData.players[winner].money == gameData.players[i].money) {
                //         winners.push(i + 1);
                //     }
                // }
                gameData.winner = winner;
                res.render('game/finished', { gameData });
            }
            else if((gameData.mDealtToResearchLine > 0) && (!gameData.everyonesDiscarded)) {
                if(gameData.players[gameData.activePlayer].isAI){
                    gameData.actingOn = `mDealt`;
                    const _id = req.params.id;
                    await GameData.replaceOne({_id}, gameData);
                }
                res.render('game/mDealt', { gameData });
            }
            else if(gameData.activePlayer === gameData.spellingPlayer) {
                if((gameData.mDealtToResearchLine > 0) && (gameData.everyonesDiscarded)) {
                    gameData.mDealtToResearchLine = 0;
                    gameData.everyonesDiscarded = false;
                    for(var i = 0; i < gameData.players.length; i++) {
                        gameData.players[i].doneDiscarding = false;
                    }
                    const _id = req.params.id;
                    await GameData.replaceOne({_id}, gameData);
                }
                if(gameData.doneSelectingFromHand) {
                    if(gameData.submitionIsAWord) {
                        if(gameData.players[gameData.activePlayer].isAI){
                            gameData.actingOn = `spellingCleanup`;
                            const _id = req.params.id;
                            await GameData.replaceOne({_id}, gameData);
                        }
                        res.render('game/spellerNormalCleanup', { gameData });
                    }
                    else {
                        //check to make sure the player is using all of the cards they set aside from their hand before allowing submition
                        var allowedToSubmit = false;
                        var numberUnselected = 0;
                        for(var i = 0; i < gameData.selectedFromHand.length; i++){
                            if(gameData.selectedFromHand[i]){
                                if(gameData.currentWordReference.includes(`hand${i}`)){
                                    //the player is using this card that they set aside from their hand
                                    allowedToSubmit = true;
                                } else{
                                    //the player is NOT using it, so should be forbidden from submitting
                                    allowedToSubmit = false;
                                    break;
                                }
                            } else{
                                numberUnselected++;
                            }
                        }
                        //if nothing was selected from the hand, allow them to spell
                        if(gameData.selectedFromHand.length == numberUnselected){
                            allowedToSubmit = true;
                        }
                        gameData.allowedToSubmit = allowedToSubmit;
                        if(gameData.players[gameData.activePlayer].isAI){
                            gameData.actingOn = `spelling`;
                            const _id = req.params.id;
                            await GameData.replaceOne({_id}, gameData);
                        }
                        res.render('game/spelling', { gameData });
                    }
                } else {
                    //check to see if there is an 'F' on the research line (for F's rule)
                    var hasF = false;
                    var hasVowel = false;
                    for(var i = 0; i < gameData.newResearchLine.length; i++) {
                        if(gameData.newResearchLine[i].letter == 'F'){
                            hasF = true;
                            break;
                        }
                    }
                    if(hasF && !gameData.doneSelectingF){
                        gameData.hasVowel = hasVowel;
                        if(gameData.temporaryF < 0){
                            gameData.fMoneySelected = false;
                        } else {
                            gameData.fMoneySelected = true;
                        }
                        if(gameData.players[gameData.activePlayer].isAI){
                            gameData.actingOn = `fRule`;
                            const _id = req.params.id;
                            await GameData.replaceOne({_id}, gameData);
                        }
                        res.render('game/fRule', { gameData });
                    } else {
                        //check to make sure there is a vowel the player can use
                        for(var i = 0; i < gameData.newResearchLine.length; i++){
                            var letter = gameData.newResearchLine[i].letter;
                            if(letter == 'A' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'){
                                hasVowel = true;
                                break;
                            }
                        }
                        if(!hasVowel){//no vowel on the research line, check the hand
                            for(var i = 0; i < gameData.players[gameData.spellingPlayer].hand.length; i++){
                                var letter = gameData.players[gameData.spellingPlayer].hand[i];
                                if(letter == 'A' || letter == 'E' || letter == 'I' || letter == 'O' || letter == 'U'){
                                    hasVowel = true;
                                    break;
                                }
                            }
                        }
                        gameData.hasVowel = hasVowel;
                        if(gameData.players[gameData.activePlayer].isAI){
                            gameData.actingOn = `selectFromHand`;
                            const _id = req.params.id;
                            await GameData.replaceOne({_id}, gameData);
                        }
                        res.render('game/selectFromHand', { gameData });
                    }           
                }
                
            }
            else {
                //check to make sure the player has bet at least 1c (assuming they have any money)
                var allowedToSubmit = false;
                for(var i = 0; i < gameData.newResearchLine.length; i++){
                    if(gameData.newResearchLine[i].bets[gameData.activePlayer]){
                        allowedToSubmit = true;
                        break;
                    }
                }
                if(gameData.players[gameData.activePlayer].money == 0){
                    allowedToSubmit = true;
                }
                gameData.allowedToSubmit = allowedToSubmit;
                if(gameData.players[gameData.activePlayer].isAI){
                    gameData.actingOn = `betting`;
                    const _id = req.params.id;
                    await GameData.replaceOne({_id}, gameData);
                }
                res.render('game/betting', { gameData });
            }
        }
    }
}

const refillDeck = (gameData) => {
    gameData.currentDeck = [...gameData.discard];
    gameData.discard = [];
    Shuffle.shuffle(gameData.currentDeck);
    return gameData;
}

module.exports.removePlayer = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const INDEX_TO_REMOVE = req.params.selectedIndex - 1;
    if(gameData.players.length > 2){
        //allow the name to be used again in the future
        for(var i = 0; i < gameData.nameList.length; i++){
            if(gameData.players[INDEX_TO_REMOVE].name == gameData.nameList[i].name){
                gameData.nameList[i].taken = false;
            }
        }
        //remove the player
        gameData.players.splice(INDEX_TO_REMOVE, 1);
        // gameData.save();
        var _id = req.params.id;
        await GameData.replaceOne({_id}, gameData);
    }
    res.redirect(`/game/${gameData._id}`);
}

module.exports.addPlayer = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    var controller = req.params.controller;
    var computer = false;
    if(controller == "human"){
        computer = false;
    } else if(controller == "computer"){
        computer = true;
    }
    if(gameData.players.length < 4){
        //make the player
        var newPlayer = {
            hand: [],
            money: 10,
            doneDiscarding: false,
            isAI: computer,
            difficulty: 'Easy',
            name: `generatedName`,
            icon: gameContents.getIconList()[gameData.players.length - 1]
        };

        newPlayer.user = req.user;

        gameData.players.push(newPlayer);

        var i = gameData.players.length - 1;
        if(gameData.players[i].isAI){
            //give the player a random name
            var indexToTake = getRandomInt(gameData.nameList.length);
            while(gameData.nameList[indexToTake].taken){
                indexToTake = getRandomInt(gameData.nameList.length);
            }
            var generatedName = gameData.nameList[indexToTake].name;
            gameData.nameList[indexToTake].taken = true;
            gameData.players[i].name = generatedName;
        } else{
            //give the human player their username
            gameData.players[i].name = req.user.username;
        }  

        // gameData.save();
        var _id = req.params.id;
        await GameData.replaceOne({_id}, gameData);
    }
    res.redirect(`/game/${gameData._id}`);
}

module.exports.changeController = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const INDEX_TO_CHANGE = req.params.selectedIndex - 1;
    gameData.players[INDEX_TO_CHANGE].isAI = !gameData.players[INDEX_TO_CHANGE].isAI;
    var i = INDEX_TO_CHANGE;
    if(gameData.players[i].isAI){
        //give the player a random name
        var indexToTake = getRandomInt(gameData.nameList.length);
        while(gameData.nameList[indexToTake].taken){
            indexToTake = getRandomInt(gameData.nameList.length);
        }
        var generatedName = gameData.nameList[indexToTake].name;
        gameData.nameList[indexToTake].taken = true;
        gameData.players[i].name = generatedName;
    } else{
        //allow the random name to be used again in the future
        for(var x = 0; x < gameData.nameList.length; x++){
            if(gameData.players[i].name == gameData.nameList[x].name){
                gameData.nameList[x].taken = false;
            }
        }
        //give the human player their username
        gameData.players[i].name = req.user.username;
    } 
    // gameData.save();
    var _id = req.params.id;
    await GameData.replaceOne({_id}, gameData);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.lobby = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    res.redirect(`/game/${gameData._id}`);
}

module.exports.difficultyEasy = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const INDEX_TO_CHANGE = req.params.selectedIndex - 1;
    gameData.players[INDEX_TO_CHANGE].difficulty = 'Easy';
    gameData.save();
    res.redirect(`/game/${gameData._id}`);
}

module.exports.difficultyMedium = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const INDEX_TO_CHANGE = req.params.selectedIndex - 1;
    gameData.players[INDEX_TO_CHANGE].difficulty = 'Medium';
    gameData.save();
    res.redirect(`/game/${gameData._id}`);
}

module.exports.difficultyHard = async (req, res, next) => {
    var gameData = await GameData.findById(req.params.id);
    const INDEX_TO_CHANGE = req.params.selectedIndex - 1;
    gameData.players[INDEX_TO_CHANGE].difficulty = 'Hard';
    gameData.save();
    res.redirect(`/game/${gameData._id}`);
}

module.exports.start = async (req, res, next) => {
    var setGameData = await GameData.findById(req.params.id);

    if(setGameData.players.length == 2){
        setGameData.bank = 50;
    } else if(setGameData.players.length == 3){
        setGameData.bank = 60;
    } else if(setGameData.players.length == 4){
        setGameData.bank = 80;
    }

    //fill all the players hands
    for(var i = 0; i < setGameData.players.length; i++){
        while (setGameData.players[i].hand.length < 3) {
            if(setGameData.currentDeck.length < 1){
                setGameData = refillDeck(setGameData);
            }
            setGameData.players[i].hand.push(setGameData.currentDeck.shift());
        }
    }

    //initialize the research line with blank slots (for things like the B rule to drop money into)
    for(var i = 0; i < 5; i++) {
        setGameData.newResearchLine.push({
            letter: `-`,
            bets: [],
            ledger: 0,
            stackSize: 1
        });
    }
    //fill it like normal
    for(var i = 0; i < 5; i++) {
        var newCard = setGameData.currentDeck.shift();
        var alreadyOnResearchLine = false;
        var index = i;
        for(var j = 0; j < setGameData.newResearchLine.length; j++) {
            if(setGameData.newResearchLine[j].letter == newCard) {
                alreadyOnResearchLine = true;
                //it's a letter that's already on the line, so just add it to it's stack
                setGameData.newResearchLine[j].stackSize++;
                //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                if(newCard == 'B'){
                    if(index == 0) {
                        setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
                        setGameData.newResearchLine[1].ledger++;
                    } else if (index == setGameData.newResearchLine.length - 1) {
                        setGameData.newResearchLine[0].ledger++;
                        setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
                    } else {
                        setGameData.newResearchLine[index - 1].ledger++;
                        setGameData.newResearchLine[index + 1].ledger++;
                    }
                    setGameData.bank -= 2;
                //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                } else if(newCard == 'C'){
                    for(var j = 0; j < setGameData.players.length; j++) {
                        if(setGameData.currentDeck.length < 1){
                            setGameData = refillDeck(setGameData);
                        }
                        setGameData.players[j].hand.push(setGameData.currentDeck.shift());
                    }
                //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
                } else if(newCard == 'M'){
                    setGameData.mDealtToResearchLine++;
                }
            }
        }
        if(alreadyOnResearchLine){
            //this is probably not the best, but reduce 'i' so as to not skip over the slot
            i--;
        } else {
            //it's a new unique letter
            setGameData.newResearchLine[i].letter = newCard;
            for(var j = 0; j < setGameData.players.length; j++) {
                setGameData.newResearchLine[i].bets[j] = 0;
            }
            //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
            if(newCard == 'B'){
                if(index == 0) {
                    setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
                    setGameData.newResearchLine[1].ledger++;
                } else if (index == setGameData.newResearchLine.length - 1) {
                    setGameData.newResearchLine[0].ledger++;
                    setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
                } else {
                    setGameData.newResearchLine[index - 1].ledger++;
                    setGameData.newResearchLine[index + 1].ledger++;
                }
                setGameData.bank -= 2;
            //'C' rule: When this is dealt to the Research Line, everyone draws 1.
            } else if(newCard == 'C'){
                for(var j = 0; j < setGameData.players.length; j++) {
                    if(setGameData.currentDeck.length < 1){
                        setGameData = refillDeck(setGameData);
                    }
                    setGameData.players[j].hand.push(setGameData.currentDeck.shift());
                }
            //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
            } else if(newCard == 'M'){
                setGameData.mDealtToResearchLine++;
            }
        }
    }
    //if there wasn't a leftover 'V'...
    if(setGameData.newResearchLine.length < 6) {
        var hasV = false;
        for(var i = 0; i < setGameData.newResearchLine.length; i++) {
            if(setGameData.newResearchLine[i].letter == 'V') {
                hasV = true;
            }
        }
        //and a new one was just added...
        if(hasV){
            //then deal one more card
            for(var i = 0; i < 1; i++){
                var newCard = setGameData.currentDeck.shift();
                var alreadyOnResearchLine = false;
                var index = setGameData.players.length - 1;
                for(var j = 0; j < setGameData.newResearchLine.length; j++) {
                    if(setGameData.newResearchLine[j].letter == newCard) {
                        alreadyOnResearchLine = true;
                        //it's a letter that's already on the line, so just add it to it's stack
                        setGameData.newResearchLine[j].stackSize++;
                        //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                        if(newCard == 'B'){
                            if(index == 0) {
                                setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
                                setGameData.newResearchLine[1].ledger++;
                            } else if (index == setGameData.newResearchLine.length - 1) {
                                setGameData.newResearchLine[0].ledger++;
                                setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
                            } else {
                                setGameData.newResearchLine[index - 1].ledger++;
                                setGameData.newResearchLine[index + 1].ledger++;
                            }
                            setGameData.bank -= 2;
                        //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                        } else if(newCard == 'C'){
                            for(var j = 0; j < setGameData.players.length; j++) {
                                if(setGameData.currentDeck.length < 1){
                                    setGameData = refillDeck(setGameData);
                                }
                                setGameData.players[j].hand.push(setGameData.currentDeck.shift());
                            }
                        //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
                        } else if(newCard == 'M'){
                            setGameData.mDealtToResearchLine++;
                        }
                    }
                }
                if(alreadyOnResearchLine){
                    //this is probably not the best, but reduce 'i' so as to not skip over the slot
                    i--;
                } else {
                    setGameData.newResearchLine.push({
                        letter: newCard,
                        bets: [],
                        ledger: 0,
                        stackSize: 1
                    });
                    for(var j = 0; j < setGameData.players.length; j++) {
                        setGameData.newResearchLine[setGameData.newResearchLine.length - 1].bets[j] = 0;
                    }
                    //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
                    if(newCard == 'B'){
                        if(index == 0) {
                            setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
                            setGameData.newResearchLine[1].ledger++;
                        } else if (index == setGameData.newResearchLine.length - 1) {
                            setGameData.newResearchLine[0].ledger++;
                            setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
                        } else {
                            setGameData.newResearchLine[index - 1].ledger++;
                            setGameData.newResearchLine[index + 1].ledger++;
                        }
                        setGameData.bank -= 2;
                    //'C' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'C'){
                        for(var j = 0; j < setGameData.players.length; j++) {
                            if(setGameData.currentDeck.length < 1){
                                setGameData = refillDeck(setGameData);
                            }
                            setGameData.players[j].hand.push(setGameData.currentDeck.shift());
                        }
                    //'M' rule: When this is dealt to the Research Line, everyone draws 1.
                    } else if(newCard == 'M'){
                        setGameData.mDealtToResearchLine++;
                    }
                }
            }
        }
    }

    //'X' rule: At the start of your turn, place 2c onto this Letter.
    for(var i = 0; i < setGameData.newResearchLine.length; i++) {
        if(setGameData.newResearchLine[i].letter == "X"){
            setGameData.newResearchLine[i].ledger += 2;
        }
    }
    setGameData.inLobby = false;

    setGameData.save();
    res.redirect(`/game/${setGameData._id}`);
}

// module.exports.createNewGame = async (req, res, next) => {
//     const setGameData = {
//         currentDeck: gameContents.newShuffledDeck(true),
//         bank: 80,
//         spellingPlayer: 0,
//         activePlayer: 0,
//         newResearchLine: [],
//         discard: [],
//         currentWord: [],
//         currentWordReference: [],
//         submitionIsAWord: false,
//         doneSelectingFromHand: false,
//         doneSelectingF: false,
//         selectedFromHand: [false, false, false],
//         discardFromHand: [false, false, false],
//         temporaryF: -1,
//         mDealtToResearchLine: 0,
//         selectedToDiscard: 0,
//         everyonesDiscarded: false,
//         lastRound: false,
//         actingOn: ``,
//         randomBettingLetter: -1,
//         bestChoice: {},
//         players: [
//             {
//                 hand: [],
//                 money: 10,
//                 doneDiscarding: false,
//                 isAI: false
//             },
//             {
//                 hand: [],
//                 money: 10,
//                 doneDiscarding: false,
//                 isAI: true
//             },
//             {
//                 hand: [],
//                 money: 10,
//                 doneDiscarding: false,
//                 isAI: true
//             },
//             {
//                 hand: [],
//                 money: 10,
//                 doneDiscarding: false,
//                 isAI: false
//             }
//         ]
//     };

//     if(setGameData.players.length == 2){
//         setGameData.bank = 50;
//     } else if(setGameData.players.length == 3){
//         setGameData.bank = 60;
//     } else if(setGameData.players.length == 4){
//         setGameData.bank = 80;
//     }

//     //fill all the players hands
//     for(var i = 0; i < setGameData.players.length; i++){
//         while (setGameData.players[i].hand.length < 3) {
//             if(setGameData.currentDeck.length < 1){
//                 setGameData = refillDeck(setGameData);
//             }
//             setGameData.players[i].hand.push(setGameData.currentDeck.shift());
//         }
//     }

//     //initialize the research line with blank slots (for things like the B rule to drop money into)
//     for(var i = 0; i < 5; i++) {
//         setGameData.newResearchLine.push({
//             letter: `-`,
//             bets: [],
//             ledger: 0,
//             stackSize: 1
//         });
//     }
//     //fill it like normal
//     for(var i = 0; i < 5; i++) {
//         var newCard = setGameData.currentDeck.shift();
//         var alreadyOnResearchLine = false;
//         var index = i;
//         for(var j = 0; j < setGameData.newResearchLine.length; j++) {
//             if(setGameData.newResearchLine[j].letter == newCard) {
//                 alreadyOnResearchLine = true;
//                 //it's a letter that's already on the line, so just add it to it's stack
//                 setGameData.newResearchLine[j].stackSize++;
//                 //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
//                 if(newCard == 'B'){
//                     if(index == 0) {
//                         setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
//                         setGameData.newResearchLine[1].ledger++;
//                     } else if (index == setGameData.newResearchLine.length - 1) {
//                         setGameData.newResearchLine[0].ledger++;
//                         setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
//                     } else {
//                         setGameData.newResearchLine[index - 1].ledger++;
//                         setGameData.newResearchLine[index + 1].ledger++;
//                     }
//                     setGameData.bank -= 2;
//                 //'C' rule: When this is dealt to the Research Line, everyone draws 1.
//                 } else if(newCard == 'C'){
//                     for(var j = 0; j < setGameData.players.length; j++) {
//                         if(setGameData.currentDeck.length < 1){
//                             setGameData = refillDeck(setGameData);
//                         }
//                         setGameData.players[j].hand.push(setGameData.currentDeck.shift());
//                     }
//                 //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
//                 } else if(newCard == 'M'){
//                     setGameData.mDealtToResearchLine++;
//                 }
//             }
//         }
//         if(alreadyOnResearchLine){
//             //this is probably not the best, but reduce 'i' so as to not skip over the slot
//             i--;
//         } else {
//             //it's a new unique letter
//             // setGameData.newResearchLine[i] = {
//             //     letter: newCard,
//             //     bets: [],
//             //     ledger: 0,
//             //     stackSize: 1
//             // }
//             setGameData.newResearchLine[i].letter = newCard;
//             for(var j = 0; j < setGameData.players.length; j++) {
//                 setGameData.newResearchLine[i].bets[j] = 0;
//             }
//             //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
//             if(newCard == 'B'){
//                 if(index == 0) {
//                     setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
//                     setGameData.newResearchLine[1].ledger++;
//                 } else if (index == setGameData.newResearchLine.length - 1) {
//                     setGameData.newResearchLine[0].ledger++;
//                     setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
//                 } else {
//                     setGameData.newResearchLine[index - 1].ledger++;
//                     setGameData.newResearchLine[index + 1].ledger++;
//                 }
//                 setGameData.bank -= 2;
//             //'C' rule: When this is dealt to the Research Line, everyone draws 1.
//             } else if(newCard == 'C'){
//                 for(var j = 0; j < setGameData.players.length; j++) {
//                     if(setGameData.currentDeck.length < 1){
//                         setGameData = refillDeck(setGameData);
//                     }
//                     setGameData.players[j].hand.push(setGameData.currentDeck.shift());
//                 }
//             //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
//             } else if(newCard == 'M'){
//                 setGameData.mDealtToResearchLine++;
//             }
//         }
//     }
//     //if there wasn't a leftover 'V'...
//     if(setGameData.newResearchLine.length < 6) {
//         var hasV = false;
//         for(var i = 0; i < setGameData.newResearchLine.length; i++) {
//             if(setGameData.newResearchLine[i].letter == 'V') {
//                 hasV = true;
//             }
//         }
//         //and a new one was just added...
//         if(hasV){
//             //then deal one more card
//             for(var i = 0; i < 1; i++){
//                 var newCard = setGameData.currentDeck.shift();
//                 var alreadyOnResearchLine = false;
//                 var index = setGameData.players.length - 1;
//                 for(var j = 0; j < setGameData.newResearchLine.length; j++) {
//                     if(setGameData.newResearchLine[j].letter == newCard) {
//                         alreadyOnResearchLine = true;
//                         //it's a letter that's already on the line, so just add it to it's stack
//                         setGameData.newResearchLine[j].stackSize++;
//                         //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
//                         if(newCard == 'B'){
//                             if(index == 0) {
//                                 setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
//                                 setGameData.newResearchLine[1].ledger++;
//                             } else if (index == setGameData.newResearchLine.length - 1) {
//                                 setGameData.newResearchLine[0].ledger++;
//                                 setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
//                             } else {
//                                 setGameData.newResearchLine[index - 1].ledger++;
//                                 setGameData.newResearchLine[index + 1].ledger++;
//                             }
//                             setGameData.bank -= 2;
//                         //'C' rule: When this is dealt to the Research Line, everyone draws 1.
//                         } else if(newCard == 'C'){
//                             for(var j = 0; j < setGameData.players.length; j++) {
//                                 if(setGameData.currentDeck.length < 1){
//                                     setGameData = refillDeck(setGameData);
//                                 }
//                                 setGameData.players[j].hand.push(setGameData.currentDeck.shift());
//                             }
//                         //'M' rule: When this is dealt to the Research Line, everyone will discard 1 card of their choice.
//                         } else if(newCard == 'M'){
//                             setGameData.mDealtToResearchLine++;
//                         }
//                     }
//                 }
//                 if(alreadyOnResearchLine){
//                     //this is probably not the best, but reduce 'i' so as to not skip over the slot
//                     i--;
//                 } else {
//                     setGameData.newResearchLine.push({
//                         letter: newCard,
//                         bets: [],
//                         ledger: 0,
//                         stackSize: 1
//                     });
//                     for(var j = 0; j < setGameData.players.length; j++) {
//                         setGameData.newResearchLine[setGameData.newResearchLine.length - 1].bets[j] = 0;
//                     }
//                     //'B' rule: When this is dealt to the Research Line, add 1c to cards on either side (ends are adjacent) from the Bank.
//                     if(newCard == 'B'){
//                         if(index == 0) {
//                             setGameData.newResearchLine[setGameData.newResearchLine.length - 1].ledger++;
//                             setGameData.newResearchLine[1].ledger++;
//                         } else if (index == setGameData.newResearchLine.length - 1) {
//                             setGameData.newResearchLine[0].ledger++;
//                             setGameData.newResearchLine[setGameData.newResearchLine.length - 2].ledger++;
//                         } else {
//                             setGameData.newResearchLine[index - 1].ledger++;
//                             setGameData.newResearchLine[index + 1].ledger++;
//                         }
//                         setGameData.bank -= 2;
//                     //'C' rule: When this is dealt to the Research Line, everyone draws 1.
//                     } else if(newCard == 'C'){
//                         for(var j = 0; j < setGameData.players.length; j++) {
//                             if(setGameData.currentDeck.length < 1){
//                                 setGameData = refillDeck(setGameData);
//                             }
//                             setGameData.players[j].hand.push(setGameData.currentDeck.shift());
//                         }
//                     //'M' rule: When this is dealt to the Research Line, everyone draws 1.
//                     } else if(newCard == 'M'){
//                         setGameData.mDealtToResearchLine++;
//                     }
//                 }
//             }
//         }
//     }

//     //'X' rule: At the start of your turn, place 2c onto this Letter.
//     for(var i = 0; i < setGameData.newResearchLine.length; i++) {
//         if(setGameData.newResearchLine[i].letter == "X"){
//             setGameData.newResearchLine[i].ledger += 2;
//         }
//     }

//     var gameData = new GameData(setGameData);

//     for(var i = 0; i < gameData.players.length; i++){
//         gameData.players[i].user = req.user._id;
//     }

//     // gameData.players[0].user = req.user._id;
//     // gameData.players[1].user = req.user._id;
//     // gameData.players[2].user = req.user._id;
//     // gameData.players[3].user = req.user._id;

//     await gameData.save();

//     res.redirect(`/game/${gameData._id}`);
// };

// module.exports.createNewGame = async (req, res, next) => {
//     res.render('game/lobby', {});
// }

module.exports.createNewGame = async (req, res, next) => {
    const setGameData = {
        currentDeck: gameContents.newShuffledDeck(true),
        bank: 80,
        spellingPlayer: 0,
        activePlayer: 0,
        newResearchLine: [],
        discard: [],
        currentWord: [],
        currentWordReference: [],
        submitionIsAWord: false,
        doneSelectingFromHand: false,
        doneSelectingF: false,
        selectedFromHand: [false, false, false],
        discardFromHand: [false, false, false],
        temporaryF: -1,
        mDealtToResearchLine: 0,
        selectedToDiscard: 0,
        everyonesDiscarded: false,
        lastRound: false,
        actingOn: ``,
        randomBettingLetter: -1,
        bestChoice: {},
        inLobby: true,
        nameList: [
            {
                name: `SpartaCat`,
                taken: false
            },
            {
                name: `Lil'Demitri`,
                taken: false
            },
            {
                name: `Sampster`,
                taken: false
            },
            {
                name: `CleverWalrus`,
                taken: false
            },
            {
                name: `BoardG4MM3R`,
                taken: false
            }
        ],
        players: [
            {
                hand: [],
                money: 10,
                doneDiscarding: false,
                isAI: false,
                difficulty: 'Easy',
                name: '-noname-'
            },
            {
                hand: [],
                money: 10,
                doneDiscarding: false,
                isAI: true,
                difficulty: 'Easy',
                name: '-noname-'
            },
            {
                hand: [],
                money: 10,
                doneDiscarding: false,
                isAI: true,
                difficulty: 'Easy',
                name: '-noname-'
            },
            {
                hand: [],
                money: 10,
                doneDiscarding: false,
                isAI: true,
                difficulty: 'Easy',
                name: '-noname-'
            }
        ]
    };

    var gameData = new GameData(setGameData);

    for(var i = 0; i < gameData.players.length; i++){
        gameData.players[i].user = req.user;
    }

    
    for(var i = 0; i < gameData.players.length; i++){
        if(gameData.players[i].isAI){
            var indexToTake = getRandomInt(gameData.nameList.length);
            while(gameData.nameList[indexToTake].taken){
                indexToTake = getRandomInt(gameData.nameList.length);
            }
            var generatedName = gameData.nameList[indexToTake].name;
            gameData.nameList[indexToTake].taken = true;
            gameData.players[i].name = generatedName;
        } else{
            gameData.players[i].name = req.user.username;
        }
    }

    var iconList = gameContents.getIconList();

    for(var i = 0; i < gameData.players.length; i++){
        gameData.players[i].icon = iconList[i];
    }

    await gameData.save();
    res.redirect(`/game/${gameData._id}/lobby`);
    
};

module.exports.rules = async (req, res, next) => {
    res.render('game/rules', {});
}