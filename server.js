const express = require('express')
const app = express()
const cors = require("cors")
const dotenv = require("dotenv")
dotenv.config()
const userService = require("./user-service.js")

const jwt = require('jsonwebtoken')
const passport = require('passport')
const passportJWT = require('passport-jwt')


const HTTP_PORT = process.env.PORT || 8080

// JSON Web Token Setup
let ExtractJwt = passportJWT.ExtractJwt
let JwtStrategy = passportJWT.Strategy

// Configure its options
let jwtOptions = {}
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt')

// IMPORTANT - this secret should be a long, unguessable string
// (ideally stored in a "protected storage" area on the web server).
// We suggest that you generate a random 50-character string
// using the following online tool:
// https://lastpass.com/generatepassword.php

jwtOptions.secretOrKey = process.env.JWT_SECRET

let strategy = new JwtStrategy(jwtOptions, function (jwt_payload, next) {
    console.log('payload received', jwt_payload)

    if (jwt_payload) {
        // The following will ensure that all routes using
        // passport.authenticate have a req.user._id, req.user.userName values
        // that matches the request payload data
        next(null, {
            _id: jwt_payload._id,
            userName: jwt_payload.userName,
        })
    } else {
        next(null, false)
    }
})

// tell passport to use our "strategy"
passport.use(strategy)

// add passport as application-level middleware
app.use(passport.initialize())

app.use(express.json())
app.use(cors())

app.post("/api/user/register", (req, res) => {
    userService.registerUser(req.body)
        .then((msg) => {
            res.json({ "message": msg })
        }).catch((msg) => {
            res.status(422).json({ "message": msg })
        })
})

app.post("/api/user/login", (req, res) => {
    userService.checkUser(req.body)
        .then((user) => {
            let token = jwt.sign({
                _id: user._id,
                userName: user.userName,
            }, jwtOptions.secretOrKey)

            res.json({ "message": "login successful", token: token })
        }).catch(msg => {
            res.status(422).json({ "message": msg })
        })
})

app.get("/api/user/favourites", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.getFavourites(req.user._id)
        .then(data => {
            res.json(data)
        }).catch(msg => {
            res.status(422).json({ error: msg })
        })

})

app.put("/api/user/favourites/:id", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.addFavourite(req.user._id, req.params.id)
        .then(data => {
            res.json(data)
        }).catch(msg => {
            res.status(422).json({ error: msg })
        })
})

app.delete("/api/user/favourites/:id", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.removeFavourite(req.user._id, req.params.id)
        .then(data => {
            res.json(data)
        }).catch(msg => {
            res.status(422).json({ error: msg })
        })
})

app.get("/api/user/history", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.getHistory(req.user._id)
        .then(data => {
            res.json(data)
        }).catch(msg => {
            res.status(422).json({ error: msg })
        })

})

// Update this route in your server file
app.put("/api/user/history", passport.authenticate('jwt', { session: false }), (req, res) => {
    if (!req.body.queryString) {
        return res.status(400).json({ error: "queryString is required" });
    }
    
    // Generate a unique ID for the history item (since service expects an ID)
    const historyId = `hist_${Date.now()}`;
    
    userService.addHistory(req.user._id, historyId)
        .then(data => {
            // Manually update the history item with the query string
            return User.findByIdAndUpdate(
                req.user._id,
                { 
                    $pull: { history: historyId }, // Remove the temporary ID
                    $push: { 
                        history: {
                            $each: [req.body.queryString],
                            $slice: -50 // Keep only last 50 items
                        } 
                    }
                },
                { new: true }
            ).exec();
        })
        .then(updatedUser => {
            res.json(updatedUser.history);
        })
        .catch(msg => {
            res.status(422).json({ error: msg });
        });
});
app.delete("/api/user/history/:id", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.removeHistory(req.user._id, req.params.id)
        .then(data => {
            res.json(data)
        }).catch(msg => {
            res.status(422).json({ error: msg })
        })
})

userService.connect()
    .then(() => {
        app.listen(HTTP_PORT, () => { console.log("API listening on: " + HTTP_PORT) })
    })
    .catch((err) => {
        console.log("unable to start the server: " + err)
        process.exit()
    })