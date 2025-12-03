import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import Cookies from "cookies";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./models/User.js";
import Comment from "./models/Comment.js";
import cors from "cors";
import jwt from "jsonwebtoken";
import "dotenv/config";

const secret = "secret123";
const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
); //mongodb+srv://adityagup780:zc9thTZGlXboGuut@cluster0.jls3etc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

// function getUserFromToken(token) {
//   if (!token) {
//     return res.status(401).json({ message: "Unauthorised" });
//   }
//   return getUserFromToken(token);
// }
function getUserFromToken(token) {
  try {
    if (!token) return null;
    const userInfo = jwt.verify(token, secret);
    return User.findById(userInfo.id);
  } catch (err) {
    return null;
  }
}

const URI = process.env.MONGODB_URI;
await mongoose
  .connect(URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
const db = mongoose.connection;
db.on("error", console.log);
app.get("/", (req, res) => {
  res.send("ok");
});
app.post("/register", (req, res) => {
  const { email, username } = req.body;
  console.log(req.body);
  const password = bcrypt.hashSync(req.body.password, 10);
  const user = new User({ email, username, password });
  user
    .save()
    .then(() => {
      // console.log(info);
      // res.sendStatus(201);
      jwt.sign({ id: user._id }, secret, (err, token) => {
        if (err) {
          console.log(err);
          res.sendStatus(500);
        } else {
          console.log(token);
          app.locals.myData = user.username;
          res.status(200).cookie("token", token).json();
        }
      });
    })
    .catch((e) => {
      console.log(e);
      res.sendStatus(500);
    });
});
app.get("/user", (req, res) => {
  const token = req.cookies.token;
  console.log(token);
  getUserFromToken(token)
    .then((user) => {
      app.locals.myData = user.username;
      res.json({ username: user.username });
    })
    .catch((err) => {
      console.log(err);
      res.sendStatus(500);
    });
});
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  User.findOne({ username }).then((user) => {
    if (user && user.username) {
      const passOk = bcrypt.compareSync(password, user.password);
      if (passOk) {
        jwt.sign({ id: user._id }, secret, (err, token) => {
          app.locals.myData = user.username;
          res.cookie("token", token).send();
        });
      } else {
        res.status(422).json("Invalid username or password");
      }
    } else {
      res.status(422).json("Invalid username or password");
    }
  });
});
// app.get("/comments", (req, res) => {
//   Comment.find().then((comments) => {
//     if (!comments) console.log("comments not found");
//     res.json(comments);
//   });
// });
app.get("/comments", (req, res) => {
  Comment.find({ rootId: null })
    .sort({ postedAt: -1 })
    .then((comments) => {
      if (comments.length === 0) {
        console.log("No comments found");
        // Send a response indicating no comments found
        return res.status(404).json({ message: "No comments found" });
      }
      // Send the comments as JSON response
      res.json(comments);
    })
    .catch((error) => {
      // Handle any errors that occur during the database query
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Internal server error" });
    });
});

app.get("/comments/root/:rootId", (req, res) => {
  Comment.find({ rootId: req.params.rootId }).sort({ postedAt: -1 }).then((comments) => {
    res.json(comments);
  });
});
app.post("/comments/:id/upvote", async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = await getUserFromToken(token);

    if (!user) return res.status(401).json({ error: "Unauthorised" });

    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: "Not found" });

    if (!comment.voters) comment.voters = [];
    if (!comment.likes) comment.likes = 0;
    if (!comment.dislikes) comment.dislikes = 0;

    const existing = comment.voters.find(
      (v) => v.userId.toString() === user._id.toString()
    );

    if (!existing) {
      comment.likes += 1;
      comment.voters.push({ userId: user._id, vote: "up" });
    } 
    else if (existing.vote === "down") {
      comment.dislikes = Math.max(0, comment.dislikes - 1);
      comment.likes += 1;
      existing.vote = "up";
    } 
    else {
      return res.json({ message: "Already upvoted" });
    }

    await comment.save();
    res.json(comment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});


app.post("/comments/:id/downvote", async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = await getUserFromToken(token);

    if (!user) return res.status(401).json({ error: "Unauthorised" });

    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: "Not found" });

    if (!comment.voters) comment.voters = [];
    if (!comment.likes) comment.likes = 0;
    if (!comment.dislikes) comment.dislikes = 0;

    const existing = comment.voters.find(
      (v) => v.userId.toString() === user._id.toString()
    );

    if (!existing) {
      comment.dislikes += 1;
      comment.voters.push({ userId: user._id, vote: "down" });
    } 
    else if (existing.vote === "up") {
      comment.likes = Math.max(0, comment.likes - 1);
      comment.dislikes += 1;
      existing.vote = "down";
    } 
    else {
      return res.json({ message: "Already downvoted" });
    }

    await comment.save();
    res.json(comment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/comments/:id", (req, res) => {
  Comment.findById(req.params.id).then((comment) => {
    res.json(comment);
  });
});
app.post("/logout", (req, res) => {
  res.cookie("token", "").send();
});

app.post("/comments", (req, res) => {
  // console.log(req.body);

  const token = req.cookies.token;
  if (!token) {
    res.sendStatus(401);
    return;
  }
  // console.log(token);
  // console.log(req.cookies.token);
  getUserFromToken(req.cookies.token)
    .then((userInfo) => {
      // const name = app.locals.myData;
      // console.log(name);
      const { title, body, parentId, rootId } = req.body;
      const comment = new Comment({
        title,
        body,
        author: userInfo.username,
        postedAt: new Date(),
        parentId,
        rootId,
      });
      comment
        .save()
        .then((savedComment) => {
          // console.log(savedComment);
          res.json(savedComment);
        })
        .catch(console.log);
    })
    .catch(() => {
      res.sendStatus(401);
    });
});

app.listen(4000);
