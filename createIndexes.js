import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Alert from './models/Alert.js';

dotenv.config();

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create indexes for User model
    console.log('Creating indexes for User model...');
    await User.collection.dropIndexes();
    await User.createIndexes();
    const userIndexes = await User.collection.getIndexes();
    console.log('User indexes:', Object.keys(userIndexes));

    // Create indexes for Alert model
    console.log('\nCreating indexes for Alert model...');
    await Alert.collection.dropIndexes();
    await Alert.createIndexes();
    const alertIndexes = await Alert.collection.getIndexes();
    console.log('Alert indexes:', Object.keys(alertIndexes));

    console.log('\n✅ All indexes created successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
};

createIndexes();
