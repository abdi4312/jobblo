const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

module.exports = async () => {
    const users = await User.find().limit(10);

    if (users.length < 2) {
        console.log('❌ Not enough users for conversations');
        return [];
    }

    await Conversation.deleteMany();
    await Message.deleteMany();

    const conversations = [];

    for (let i = 0; i < 5; i++) {
        const convo = await Conversation.create({
            participants: [users[i]._id, users[i + 1]._id],
            lastMessage: 'Hei! Er du tilgjengelig?'
        });

        await Message.create({
            conversationId: convo._id,
            senderId: users[i]._id,
            content: 'Hei! Er du tilgjengelig?',
            read: false
        });

        conversations.push(convo);
    }

    console.log(`💬 Conversations: ${conversations.length}`);
    return conversations;
};
