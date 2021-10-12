const Shuffle = require('../utils/shuffle');

module.exports.getIconList = () => {
    return [
        `https://res.cloudinary.com/djcc248bk/image/upload/w_50,c_fill,ar_1:1,g_auto,r_max,bo_2px_solid_black/v1624935769/ExtraExtra/Characters/Bernie.png`,
        `https://res.cloudinary.com/djcc248bk/image/upload/w_50,c_fill,ar_1:1,g_auto,r_max,bo_2px_solid_black/v1624935769/ExtraExtra/Characters/Gates.png`,
        `https://res.cloudinary.com/djcc248bk/image/upload/w_50,c_fill,ar_1:1,g_auto,r_max,bo_2px_solid_black/v1624935769/ExtraExtra/Characters/Besos.png`,
        `https://res.cloudinary.com/djcc248bk/image/upload/w_50,c_fill,ar_1:1,g_auto,r_max,bo_2px_solid_black/v1624935769/ExtraExtra/Characters/Dimitri.png`
    ];
}

module.exports.newShuffledDeck = (ownsGame) => {
    let deck = [];
    if(ownsGame) {
        //give them all the letters
        deck.push(...addLetter('A', 9));
        deck.push(...addLetter('B', 3));
        deck.push(...addLetter('C', 3));
        deck.push(...addLetter('D', 4));
        deck.push(...addLetter('E', 9));
        deck.push(...addLetter('F', 4));
        deck.push(...addLetter('G', 3));
        deck.push(...addLetter('H', 4));
        deck.push(...addLetter('I', 6));
        deck.push(...addLetter('J', 2));
        deck.push(...addLetter('K', 2));
        deck.push(...addLetter('L', 5));
        deck.push(...addLetter('M', 3));
        deck.push(...addLetter('N', 5));
        deck.push(...addLetter('O', 5));
        deck.push(...addLetter('P', 3));
        deck.push(...addLetter('Q', 1));
        deck.push(...addLetter('R', 5));
        deck.push(...addLetter('S', 6));
        deck.push(...addLetter('T', 6));
        deck.push(...addLetter('U', 3));
        deck.push(...addLetter('V', 3));
        deck.push(...addLetter('W', 3));
        deck.push(...addLetter('X', 2));
        deck.push(...addLetter('Y', 3));
        deck.push(...addLetter('Z', 1));
    }
    else {
        //only give them most of the letters
        deck.push(...addLetter('A', 9));
        deck.push(...addLetter('B', 3));
        deck.push(...addLetter('C', 3));
        deck.push(...addLetter('D', 4));
        deck.push(...addLetter('E', 9));
        deck.push(...addLetter('F', 4));
        deck.push(...addLetter('G', 3));
        deck.push(...addLetter('H', 4));
        deck.push(...addLetter('I', 6));
        deck.push(...addLetter('J', 2));
        deck.push(...addLetter('K', 2));
        deck.push(...addLetter('L', 5));
        deck.push(...addLetter('M', 3));
        deck.push(...addLetter('N', 5));
        deck.push(...addLetter('O', 5));
        deck.push(...addLetter('P', 3));
        deck.push(...addLetter('Q', 1));
        deck.push(...addLetter('R', 5));
        deck.push(...addLetter('S', 6));
        deck.push(...addLetter('T', 6));
        deck.push(...addLetter('U', 3));
        deck.push(...addLetter('V', 3));
        deck.push(...addLetter('W', 3));
        deck.push(...addLetter('X', 2));
        deck.push(...addLetter('Y', 3));
        deck.push(...addLetter('Z', 1));
    }
    return Shuffle.shuffle(deck);
}

const addLetter = (letter, amount) => {
    var toReturn = [];
    for(var i = 0; i < amount; i++) {
        toReturn.push(letter);
    }
    return toReturn;
}
