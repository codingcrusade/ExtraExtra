const User = require('../../models/user');

module.exports.renderRegister = (req, res) => {
    res.render('users/register');
};

module.exports.register = async (req, res, next) => {
    try {
        const { username, password } = req.body;  //add {email} if desired
        const user = new User({ username });//add {email} if desired
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            const redirectUrl = req.session.returnTo || '/';
            delete req.session.returnTo;
            //res.redirect(redirectUrl);
            res.redirect('/');
        });
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('register');
    }
};

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
};

module.exports.login = (req, res) => {
    req.flash('success', 'Welcome back!');
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    //res.redirect(redirectUrl);
    res.redirect('/');
};

module.exports.logout = (req, res) => {
    req.logout();
    req.flash('success', "Logged out!");
    res.redirect('/');
};

module.exports.renderProfile = (req, res) => {
    res.render('users/profile');
};