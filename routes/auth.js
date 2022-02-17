const router = require('express').Router()
const Tool = require('../models/Tool.model')


// ℹ️ Handles password encryption
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')

// How many rounds should bcrypt run the salt (default [10 - 12 rounds])
const saltRounds = 10

// Require the User model in order to interact with the database
const User = require('../models/User.model')

// Require necessary (isLoggedOut and isLiggedIn) middleware in order to control access to specific routes
const isLoggedOut = require('../middleware/isLoggedOut')
const isLoggedIn = require('../middleware/isLoggedIn')

router.get('/signup', isLoggedOut, (req, res) => {
  Tool.find().then((tools) => {
    res.render('auth/signup', { tools: tools, layout: false })
  })
})

router.post('/signup', isLoggedOut, (req, res) => {
  const { username, email, password, toolsAvailable } = req.body

  if (!email) {
    return res
      .status(400)
      .render('auth/signup', { errorMessage: 'Please provide your E-Mail.', layout: false })
  }

  if (password.length < 3) {
    return res.status(400).render('auth/signup', {
      errorMessage: 'Your password needs to be at least 8 characters long.', layout: false
    })
  }

  //   ! This use case is using a regular expression to control for special characters and min length
  /*
  const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;

  if (!regex.test(password)) {
    return res.status(400).render("signup", {
      errorMessage:
        "Password needs to have at least 8 chars and must contain at least one number, one lowercase and one uppercase letter.",
    });
  }
  */

  // Search the database for a user with the username submitted in the form
  User.findOne({ email }).then((found) => {
    // If the user is found, send the message username is taken
    if (found) {
      return res
        .status(400)
        .render('auth/signup', { errorMessage: 'E-Mail already taken.', layout: false })
    }

    // if user is not found, create a new user - start with hashing the password
    return bcrypt
      .genSalt(saltRounds)
      .then((salt) => bcrypt.hash(password, salt))
      .then((hashedPassword) => {
        // Create a user and save it in the database
        return User.create({
          username,
          email,
          password: hashedPassword,
          toolsAvailable,

        })
      })
      .then((user) => {
        // Bind the user to the session object
        req.session.user = user
        res.redirect('/')
      })
      .catch((error) => {
        if (error instanceof mongoose.Error.ValidationError) {
          return res
            .status(400)
            .render('auth/signup', { errorMessage: error.message, layout: false })
        }
        if (error.code === 11000) {
          return res.status(400).render('auth/signup', {
            errorMessage:
              'Name needs to be unique. The Username you chose is already in use.', layout: false
          })
        }
        return res
          .status(500)
          .render('auth/signup', { errorMessage: error.message, layout: false })
      })
  })
})

router.get('/login', isLoggedOut, (req, res) => {
  res.render('auth/login', { layout: false })
})

router.post('/login', isLoggedOut, (req, res, next) => {
  const { email, password } = req.body

  if (!email) {
    return res
      .status(400)
      .render('auth/login', { errorMessage: 'Please provide your E-Mail.', layout: false })
  }

  // Here we use the same logic as above
  // - either length based parameters or we check the strength of a password
  if (password.length < 3) {
    return res.status(400).render('auth/login', {
      errorMessage: 'Your password needs to be at least 8 characters long.', layout: false
    })
  }

  // Search the database for a user with the username submitted in the form
  User.findOne({ email })
    .then((user) => {
      // If the user isn't found, send the message that user provided wrong credentials
      if (!user) {
        return res
          .status(400)
          .render('auth/login', { errorMessage: 'Wrong credentials.', layout: false })
      }

      // If user is found based on the username, check if the in putted password matches the one saved in the database
      bcrypt.compare(password, user.password).then((isSamePassword) => {
        if (!isSamePassword) {
          return res
            .status(400)
            .render('auth/login', { errorMessage: 'Wrong credentials.' })
        }
        req.session.user = user
        // req.session.user = user._id; // ! better and safer but in this case we saving the entire user object
        return res.redirect('/')
      })
    })

    .catch((err) => {
      // in this case we are sending the error handling to the error handling middleware that is defined in the error handling file
      // you can just as easily run the res.status that is commented out below
      next(err)
      // return res.status(500).render("login", { errorMessage: err.message });
    })
})


//logout
router.get('/logout', isLoggedIn, (req, res, next) => {
  req.session.destroy()
  res.redirect('/login')
})

module.exports = router
