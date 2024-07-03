const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const express = require('express');
const app = express();
require('mongoose-type-url');
mongoose.set('strictQuery', false);
const bcrypt = require('bcrypt');
const saltRounds = 10;
const path = require('path');

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // support json encoded bodies
const cors = require('cors');
const { json } = require('body-parser');
const corsOptions = {
  origin: '*',
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Log environment variable for debugging
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

//Schema  i.e the structure we want for data
const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  isSold: Boolean,
  description: String,
  imageUrl: String,
  // imageUrl: mongoose.SchemaTypes.Url,
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  boughtItems: [itemSchema],
  listedItems: [itemSchema],
  cartItems: [itemSchema],
  wishlist: [itemSchema],
});

//Model
const Item = mongoose.model('Item', itemSchema);
const User = mongoose.model('User', userSchema);

// console.log(user1);
const item1 = new Item({
  //new document in the collection
  name: 'Table',
  price: 8000,
  isSold: false,
});

// item1.save();

const item2 = new Item({
  name: 'Computer',
  price: 50000,
  isSold: true,
  imageUrl:
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Y29tcHV0ZXJ8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60',
});
// console.log(item2);

app.use(express.static(path.resolve(__dirname, '../client/build')));

app.get('/api', (req, res) => {
  Item.find({ isSold: false }, function (err, foundItems) {
    if (foundItems) {
      res.send(foundItems);
      //   console.log(foundItems);
    } else console.log(err);
  });
});

app.post('/new-item', (req, res) => {
  const data = req.body[0];
  const itemName = data.itemName;
  const itemPrice = data.itemPrice;
  const itemImgUrl = data.itemImgUrl;
  const itemDescription = data.itemDescription;
  const userName = data.userName;
  const userId = data.userId;
  // console.log(userName);

  const newItem = new Item({
    name: itemName,
    price: itemPrice,
    isSold: false,
    imageUrl: itemImgUrl,
    description: itemDescription,
  });

  newItem.save((err) =>
    !err
      ? User.findOne({ _id: userId }, (err, foundUser) => {
          !err &&
            User.findOneAndUpdate(
              //Adding new item in Seller's listings page
              { _id: foundUser._id },
              { listedItems: [...foundUser.listedItems, newItem] },
              { returnOriginal: false },
              (err, updatedUser) => {
                !err
                  ? res.send(JSON.stringify(updatedUser)) &&
                    console.log('superFunPoop')
                  : res.send('poop') && console.log(err + 'poop');
              }
            );
        })
      : console.log(err)
  );
});

app.post('/buy-item', (req, res) => {
  const data = req.body[0];
  const itemId = data.itemId;
  const userId = data.userId;
  // console.log(data);

  //Setting Sell status to Sold in Seller's MyAccount Listing Page
  Item.findOne({ _id: itemId }, (err, foundedItem) => {
    User.findOne(
      { listedItems: { $in: [foundedItem] } },
      (err, foundedUser) => {
        User.findOneAndUpdate(
          { _id: foundedUser._id, 'listedItems._id': itemId },
          { $set: { 'listedItems.$.isSold': true } },
          { returnOriginal: false },
          (err, updatedUser) => {
            !err ? '' : console.log(err);
          }
        );
      }
    );
  }) &&
    Item.findOneAndUpdate(
      //Setting Item sell status to Sold in ItemsDB
      { _id: itemId },
      { isSold: true },
      { returnOriginal: false },
      (err, updatedItem) => {
        !err
          ? User.findOne({ _id: userId }, (err, foundUser) => {
              !err &&
                User.findOneAndUpdate(
                  //Adding New Item to Buyer's Bought items list
                  { _id: foundUser._id },
                  { boughtItems: [...foundUser.boughtItems, updatedItem] },
                  { returnOriginal: false },
                  (err, updatedUser) => {
                    !err
                      ? res.send(JSON.stringify(updatedUser)) &&
                        console.log('superFunPoopaMania')
                      : res.send('poop') && console.log(err + 'poop');
                  }
                ) &&
                User.findOneAndUpdate(
                  { _id: userId },
                  { $pull: { cartItems: { _id: itemId } } },
                  { returnOriginal: false },
                  (err, updated) =>
                    !err ? console.log('success') : console.log(err)
                );
            })
          : console.log(err);
      }
    );
});
app.post('/wishlist', (req, res) => {
  const data = req.body[0];
  const itemId = data.itemId;
  const userId = data.userId;
  // console.log(data);

  Item.findOne({ _id: itemId }, (err, foundItem) => {
    User.findOne(
      { _id: userId, wishlist: { $in: [foundItem] } },
      (err, foundUser) => {
        foundUser
          ? User.findOneAndUpdate(
              { _id: foundUser._id },
              { $pull: { wishlist: { _id: itemId } } },
              { returnOriginal: false },
              (err, updatedUser) => {
                !err
                  ? res.send(JSON.stringify(updatedUser)) &&
                    console.log('removed from wishlist')
                  : res.send('poop') && console.log(err);
              }
            )
          : User.findOne({ _id: userId }, (err, foundUser) => {
              User.findOneAndUpdate(
                { _id: foundUser._id },
                { wishlist: [...foundUser.wishlist, foundItem] },
                { returnOriginal: false },
                (err, updatedUser) => {
                  !err
                    ? res.send(JSON.stringify(updatedUser)) &&
                      console.log('done')
                    : res.send('poop') && console.log(err);
                }
              );
            });
      }
    );
  });
});

app.post('/add-to-cart', (req, res) => {
  const data = req.body[0];
  const itemId = data.itemId;
  const userId = data.userId;
  // console.log(data);

  Item.findOne({ _id: itemId }, (err, foundItem) => {
    User.findOne({ _id: userId }, (err, foundUser) => {
      User.findOneAndUpdate(
        { _id: foundUser._id },
        { cartItems: [...foundUser.cartItems, foundItem] },
        { returnOriginal: false },
        (err, updatedUser) => {
          !err
            ? res.send(JSON.stringify(updatedUser)) && console.log('done')
            : res.send('poop') && console.log(err);
        }
      );
    });
  });
});

app.post('/login', (req, res) => {
  const data = req.body[0];
  const username = data.username;
  const password = data.password;
  // console.log(data);
  User.findOne({ username: username }, (err, foundUser) => {
    !err && foundUser
      ? bcrypt.compare(password, foundUser.password, (err, result) =>
          !err && result
            ? res.send(JSON.stringify(foundUser))
            : console.log(err + 'poop')
        )
      : res.send(JSON.stringify('poop'));
  });
});
app.post('/register', (req, res) => {
  const data = req.body[0];
  const username = data.username;
  const password = data.password;

  bcrypt.hash(password, saltRounds, function (err, hash) {
    const newUser = new User({
      username: username,
      password: hash,
    });

    newUser.save((err) => {
      //password will be encrypted now
      if (!err) {
        res.send(JSON.stringify(username));
      } else {
        console.log(err);
      }
    });
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
