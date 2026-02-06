const HYPESQUAD_HOUSES = {
  BRAVERY: 1,
  BRILLIANCE: 2,
  BALANCE: 3,
};

// from https://web.archive.org/web/20221019062532if_/https://discord.com/assets/2c642b44e59d54018b37.js
const HYPESQUAD_QA = [
  {
    q: "Which insult would hurt you the most?",
    a: [
      "You overreact a lot.",          // Option A is for Bravery (source: https://www.reddit.com/r/discordapp/comments/nnzwwq/how_to_cheat_on_the_hypesquad_quiz)
      "You don't listen enough.",      // Option B is for Brilliance
      "You only care about yourself.", // Option C is for Balance
      "You're ordinary."               // Option D chooses randomly
    ]
  },
  {
    q: "What sounds like a perfect day to you?",
    a: [
      "Sleeping in, having a giant, homemade lunch, and heading out to meet up with close friends late at night.",
      "Waking up early, finishing something you've been putting off for a while, and working on a new hobby in the late afternoon.",
      "Waking up on time, walking to the garden store and buying a new plant, and sinking deep into a bath to end the day.",
      "Waking up with no plans, taking the day as it comes."
    ]
  },
  {
    q: "What's something positive about you that you would agree with?",
    a: [
      "Making decisions is easy for you.",
      "It's easy for you to understand new things.",
      "You're dependable.",
      "You tend to see the good in people."
    ]
  },
  {
    q: "Which of these smells makes you happiest?",
    a: [
      "Air that's deep and smokey from a campfire, and sweet from toasted marshmallows.",
      "Crisp, cool air revitalized after a thunderstorm.",
      "Fresh flowers in bloom mixed with the clean smell of laundry drying on a line.",
      "Walking into a kitchen after something flavorful has been slow cooking for 8 hours as fresh bread cools on the counter."
    ]
  },
  {
    q: "Your favorite out of these genres is:",
    a: [
      "Fiction",
      "Biographies and memoirs",
      "Poetry",
      "Romance"
    ]
  },
  {
    q: "You and your best friend get into a fight. No one is clearly in the wrong. You:",
    a: [
      "Wait to see if they apologize first, but eventually give in and reach out.",
      "Apologize first but secretly be upset you had to say something first.",
      "Apologize first and truly mean it.",
      "Never apologize. Whatever happens, happens."
    ]
  },
  {
    q: "Your dream exotic animal companion would be:",
    a: [
      "Something intimidating and protective like a bear.",
      "Something small and nimble like a fox.",
      "Something large and helpful like an elephant.",
      "Something different and eye catching like a komodo dragon."
    ]
  },
  {
    q: "Your dream house would definitely have a:",
    a: [
      "Perfectly sized bedroom with an extravagantly comfy bed.",
      "Giant, roaring fireplace with a cat sleeping calmly in front.",
      "Some seriously beautiful outdoor space.",
      "An expansive living room meant for hanging out in with tons of natural light."
    ]
  },
  {
    q: "You would want a job that:",
    a: [
      "Challenges you in a way that makes you grow. You don't feel bored in your day to day.",
      "You're really good at and are looked to for advice.",
      "Lets you feel like you're making a difference in something.",
      "You do what needs to be done, but you're not really too invested in it."
    ]
  },
  {
    q: "How do you react to learning new things?",
    a: [
      "You tend to stay away from learning new things and focus on becoming better at things you're already good at.",
      "Get really frustrated you aren't good at the start and become obsessive.",
      "Take things slowly and learn step-by-step to make sure you get things right.",
      "Give up early and often."
    ]
  },
  {
    q: "You can only listen to one type of music for the rest of your life. Do you pick:",
    a: [
      "Something catchy that gets you excited.",
      "Something unintrusive that helps you concentrate.",
      "Something relaxing that puts you at ease.",
      "Something nostalgic that you know well."
    ]
  },
  {
    q: "Vacation time. Where are you going?",
    a: [
      "Somewhere new and extremely different from where you live.",
      "Somewhere quiet. It's not a vacation unless you get to relax and reset.",
      "A place you've been before that you have grown to see as a second home.",
      "Stay at home. You're not one for travelling."
    ]
  },
  {
    q: "Your computer desk looks like:",
    a: [
      "A mess to anyone who isn't you. But you know where everything is...",
      "A mess. And you're not sure where everything is...",
      "Kinda simple but you really like it.",
      "Something out of a magazine. It's clean and decorative."
    ]
  },
  {
    q: "The nightmare situation finally happens to you. You order food at a restaurant and what comes out is not what you ordered. You:",
    a: [
      "Don't complain. Just send it back because you were really craving that one thing.",
      "Complain to the table that this isn't what you ordered but don't send it back.",
      "Eat it without saying anything to anyone.",
      "Complain to the waiter that this isn't what you ordered and send it back."
    ]
  },
  {
    q: "You're on your way out the door to something important, but your neighbor says that they need help with something. You:",
    a: [
      "Help them and don't worry about the other thing you were on your way to.",
      "Apologize to your neighbor but insist you have something you must get to.",
      "Knock on your other neighbor's door and ask them if they can help out in your place.",
      "Pretend you didn't hear them."
    ]
  }
];

export { HYPESQUAD_HOUSES, HYPESQUAD_QA };
