const express = require('express');
const router = express.Router();
const activeGame = require('./controllers/activeGame');
const catchAsync = require('../utils/catchAsync');
const passport = require('passport');
const { isLoggedIn } = require('../middleware');

router.route('/newGame')
    .get(isLoggedIn, catchAsync(activeGame.createNewGame));

router.route('/rules')
    .get(catchAsync(activeGame.rules));

router.route('/:id')
    .get(catchAsync(activeGame.getActiveGame));

router.route('/:id/writersBlock')
    .get(catchAsync(activeGame.writersBlock));

router.route('/:id/skipTurn')
    .get(catchAsync(activeGame.skipTurn));
    
router.route('/:id/submitHandCards')
    .get(catchAsync(activeGame.submitHandCards));

router.route('/:id/changeActivePlayer')
    .get(catchAsync(activeGame.changeActivePlayer));

router.route('/:id/undoBet')
    .get(catchAsync(activeGame.undoBet));

router.route('/:id/submitSpelling')
    .get(catchAsync(activeGame.submitSpelling));

router.route('/:id/cleanUpPhase')
    .get(catchAsync(activeGame.cleanUpPhase));

router.route('/:id/selectFromHand/:selectedIndex')
    .get(catchAsync(activeGame.selectFromHand));

router.route('/:id/addLetter/:selectedIndex')
    .get(catchAsync(activeGame.addOrRemoveLetterFromWord));

router.route('/:id/addBet/:selectedIndex')
    .get(catchAsync(activeGame.addBet));

router.route('/:id/addF/:selectedIndex')
    .get(catchAsync(activeGame.addF));

router.route('/:id/undoF')
    .get(catchAsync(activeGame.undoF));

router.route('/:id/confirmF')
    .get(catchAsync(activeGame.confirmF));

router.route('/:id/discardFromHand/:selectedIndex')
    .get(catchAsync(activeGame.discardFromHand));

router.route('/:id/undoDiscard')
    .get(catchAsync(activeGame.undoDiscard));

router.route('/:id/confirmDiscard')
    .get(catchAsync(activeGame.confirmDiscard));

router.route('/:id/debugDealResearchLine')
    .post(catchAsync(activeGame.debugDealResearchLine));
    
router.route('/:id/debugChangeController')
    .post(catchAsync(activeGame.debugChangeController));

router.route('/:id/lobby')
    .get(isLoggedIn, catchAsync(activeGame.lobby));

router.route('/:id/removePlayer/:selectedIndex')
    .get(catchAsync(activeGame.removePlayer));

router.route('/:id/addPlayer/:controller')
    .get(catchAsync(activeGame.addPlayer));

router.route('/:id/changeController/:selectedIndex')
    .get(catchAsync(activeGame.changeController));

router.route('/:id/difficultyEasy/:selectedIndex')
    .get(catchAsync(activeGame.difficultyEasy));

router.route('/:id/difficultyMedium/:selectedIndex')
    .get(catchAsync(activeGame.difficultyMedium));

router.route('/:id/difficultyHard/:selectedIndex')
    .get(catchAsync(activeGame.difficultyHard));

router.route('/:id/start')
    .get(catchAsync(activeGame.start));

module.exports = router;

