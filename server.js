const express = require('express');
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const userService = require("./user-service.js");
const passport = require('passport');
const passportJWT = require('passport-jwt');
const jwt = require('jsonwebtoken');

const HTTP_PORT = process.env.PORT || 8080;

// JWT Strategy Configuration
const ExtractJWT = passportJWT.ExtractJwt;
const JWTStrategy = passportJWT.Strategy;

// Configure passport to use JWT strategy
passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
}, (jwtPayload, done) => {
    return done(null, jwtPayload);
}));

app.use(express.json());
app.use(cors());
app.use(passport.initialize());

// =============================================
// TESTING ENDPOINTS
// =============================================

/**
 * @api {get} /api/test/env Test Environment Variables
 * @apiName TestEnv
 * @apiGroup Testing
 * 
 * @apiSuccess {Object} env Environment variables status
 */
app.get("/api/test/env", (req, res) => {
    res.json({
        status: "API is running",
        environment: {
            MONGO_URL: process.env.MONGO_URL ? "✅ Set" : "❌ Not set",
            JWT_SECRET: process.env.JWT_SECRET ? "✅ Set" : "❌ Not set",
            NODE_ENV: process.env.NODE_ENV || "development"
        },
        note: "If any variables show as 'Not set', check your Vercel environment variables configuration"
    });
});

/**
 * @api {get} /api/test/db Test Database Connection
 * @apiName TestDB
 * @apiGroup Testing
 * 
 * @apiSuccess {String} status Database connection status
 */
app.get("/api/test/db", (req, res) => {
    userService.isConnected()
        .then(() => res.json({ 
            status: "✅ Database connected successfully",
            dbConnection: userService.getConnectionStatus()
        }))
        .catch(err => res.status(500).json({ 
            status: "❌ Database connection failed",
            error: err.message,
            MONGO_URL: process.env.MONGO_URL ? "Set" : "Not set"
        }));
});

/**
 * @api {post} /api/test/jwt Test JWT Generation
 * @apiName TestJWT
 * @apiGroup Testing
 * 
 * @apiParam {String} userName Test username for JWT
 * 
 * @apiSuccess {String} token Generated JWT token
 */
app.post("/api/test/jwt", (req, res) => {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: "JWT_SECRET not configured" });
    }

    const payload = {
        _id: "test_id",
        userName: req.body.userName || "testuser"
    };

    try {
        const token = jwt.sign(payload, process.env.JWT_SECRET);
        res.json({ 
            status: "✅ JWT generated successfully",
            token: token,
            decoded: jwt.verify(token, process.env.JWT_SECRET)
        });
    } catch (err) {
        res.status(500).json({ 
            status: "❌ JWT generation failed",
            error: err.message 
        });
    }
});

// =============================================
// MAIN API ENDPOINTS
// =============================================

app.post("/api/user/register", (req, res) => {
    userService.registerUser(req.body)
    .then((msg) => {
        res.json({ "message": msg });
    }).catch((msg) => {
        res.status(422).json({ "message": msg });
    });
});

app.post("/api/user/login", (req, res) => {
    userService.checkUser(req.body)
    .then((user) => {
        const payload = {
            _id: user._id,
            userName: user.userName
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET);
        
        res.json({ 
            message: "login successful",
            token: token,
            user: payload
        });
    }).catch(msg => {
        res.status(422).json({ "message": msg });
    });
});

// Protected routes
app.get("/api/user/favourites", passport.authenticate('jwt', { session: false }), (req, res) => {
    userService.getFavourites(req.user._id)
    .then(data => {
        res.json(data);
    }).catch(msg => {
        res.status(422).json({ error: msg });
    });
});

// ... (keep all your existing protected routes as they are)

// =============================================
// SERVER INITIALIZATION
// =============================================

userService.connect()
.then(() => {
    app.listen(HTTP_PORT, () => { 
        console.log(`API listening on: ${HTTP_PORT}`);
        console.log("Test endpoints available:");
        console.log(`- GET http://localhost:${HTTP_PORT}/api/test/env`);
        console.log(`- GET http://localhost:${HTTP_PORT}/api/test/db`);
        console.log(`- POST http://localhost:${HTTP_PORT}/api/test/jwt`);
    });
})
.catch((err) => {
    console.log("Unable to start the server: " + err);
    console.log("Environment variables:");
    console.log("- MONGO_URL:", process.env.MONGO_URL ? "Set" : "Not set");
    console.log("- JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");
    process.exit();
});

module.exports = app;