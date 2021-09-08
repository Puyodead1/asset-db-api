const express = require("express");
const PassportJWT = require("passport-jwt");
const passport = require("passport");
const config = require("./config");
const JWT = require("jsonwebtoken");
const MongoClient = require("mongodb").MongoClient;
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const morgan = require("morgan");
const cors = require("cors");

class Backend {
  constructor() {
    this.app = express();
    this.mongoClient = null;
    this.db = null;
    this.resourcesCollection = null;
    this.usersCollection = null;

    this.app.use(
      cors({
        origin: "*",
      })
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.app.use(morgan("dev"));
  }

  setupStrategy() {
    const strategy = new PassportJWT.Strategy(
      {
        jwtFromRequest: PassportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwtSecret,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      },
      (payload, done) => {
        return this.usersCollection.findOne(
          { id: payload.id },
          (err, result) => {
            if (err) return done(err, null);
            if (!result) return done("Invalid user", null);
            return done(null, result);
          }
        );
      }
    );
    passport.use(strategy);
  }

  setupRoutes() {
    this.app.post(
      "/register",
      body("username").isString().isLength({ min: 8, max: 20 }),
      body("password").isString().isLength({ min: 8 }),
      (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const username = req.body.username;
        const password = req.body.password;

        return this.usersCollection.insertOne(
          {
            id: uuidv4(),
            username,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
          },
          (err, result) => {
            if (err) return res.status(400).json({ error: err.message });

            console.log(result);

            return res.status(201).json({ message: "You may now login" });
          }
        );
      }
    );

    this.app.post(
      "/login",
      body("username").isString(),
      body("password").isString(),
      (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }

        const username = req.body.username;
        const password = req.body.password;
        this.usersCollection.findOne({ username }, (err, result) => {
          if (err) return res.status(400).json({ error: err.message });
          if (!result)
            return res
              .status(400)
              .json({ error: "Username or password is invalid" });
          return bcrypt.compare(password, result.password, (err, same) => {
            if (err) return res.status(400).json({ error: err });
            if (!same)
              return res
                .status(400)
                .json({ error: "Username or password is invalid" });

            return JWT.sign(
              result,
              config.jwtSecret,
              {
                issuer: config.jwtIssuer,
                audience: config.jwtAudience,
              },
              (err, token) => {
                if (err) return res.status(400).json({ error: err.message });
                return res.json({ ...result, token });
              }
            );
          });
        });
      }
    );

    this.app.use(
      "/api/v1",
      passport.authenticate("jwt", { session: false }),
      require("./APIRoute.js")(this.app, this)
    );
  }

  async init() {
    console.log("Connecting to MongoDB...");
    MongoClient.connect(config.mongoURI, (err, client) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      this.mongoClient = client;
      this.db = this.mongoClient.db();
      this.resourcesCollection = this.db.collection("resources");
      this.usersCollection = this.db.collection("users");

      console.log("MongoDB Connection established!");

      this.setupStrategy();
      this.setupRoutes();

      this.app.listen(config.port, () => {
        console.log(`Server started on port ${config.port}`);
      });
    });
  }
}

(async () => {
  const backend = new Backend();
  await backend.init();
})();
