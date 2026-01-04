import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';
import Alert from './models/Alert.js';
import Notification from './models/Notification.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Alert.deleteMany({});
    await Notification.deleteMany({});
    console.log('Cleared existing data');

    // Create users (all passwords: "password123")
    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await User.create([
      // Police accounts
      {
        name: 'Police Station 1',
        email: 'police1@naga.gov.ph',
        password: hashedPassword,
        userType: 'police',
        contactNumber: '09171234567',
        location: {
          type: 'Point',
          coordinates: [123.1816, 13.6218] // Naga City Hall area
        },
        address: 'Naga City Police Station 1, Panganiban Drive, Naga City',
        status: 'active',
        isVerified: true
      },
      {
        name: 'Police Station 2',
        email: 'police2@naga.gov.ph',
        password: hashedPassword,
        userType: 'police',
        contactNumber: '09171234568',
        location: {
          type: 'Point',
          coordinates: [123.1850, 13.6190] // Carolina area
        },
        address: 'Naga City Police Station 2, Carolina, Naga City',
        status: 'active',
        isVerified: true
      },
      
      // Hospital accounts
      {
        name: 'Bicol Medical Center',
        email: 'bmc@hospital.ph',
        password: hashedPassword,
        userType: 'hospital',
        contactNumber: '09181234567',
        location: {
          type: 'Point',
          coordinates: [123.1789, 13.6195] // BMC location
        },
        address: 'Bicol Medical Center, Concepcion Pequeña, Naga City',
        status: 'active',
        isVerified: true
      },
      {
        name: 'Naga City Hospital',
        email: 'ncgh@hospital.ph',
        password: hashedPassword,
        userType: 'hospital',
        contactNumber: '09181234568',
        location: {
          type: 'Point',
          coordinates: [123.1820, 13.6240] // Downtown area
        },
        address: 'Naga City General Hospital, Peñafrancia Ave, Naga City',
        status: 'active',
        isVerified: true
      },

      // Fire stations
      {
        name: 'Naga Fire Station',
        email: 'fire@naga.gov.ph',
        password: hashedPassword,
        userType: 'fire',
        contactNumber: '09191234567',
        location: {
          type: 'Point',
          coordinates: [123.1805, 13.6210] // Near city center
        },
        address: 'Naga City Fire Station, Barlin Street, Naga City',
        status: 'active',
        isVerified: true
      },

      // Citizen accounts
      {
        name: 'Juan Dela Cruz',
        email: 'juan@email.com',
        password: hashedPassword,
        userType: 'citizen',
        contactNumber: '09201234567',
        location: {
          type: 'Point',
          coordinates: [123.1830, 13.6200]
        },
        address: 'Barangay Dinaga, Naga City',
        emergencyContacts: [
          { name: 'Maria Dela Cruz', relationship: 'wife', contactNumber: '09201234568' }
        ],
        status: 'active',
        isVerified: true
      },
      {
        name: 'Maria Santos',
        email: 'maria@email.com',
        password: hashedPassword,
        userType: 'citizen',
        contactNumber: '09211234567',
        location: {
          type: 'Point',
          coordinates: [123.1870, 13.6180]
        },
        address: 'Barangay Carolina, Naga City',
        emergencyContacts: [
          { name: 'Pedro Santos', relationship: 'husband', contactNumber: '09211234568' }
        ],
        status: 'active',
        isVerified: true
      },

      // Family member accounts
      {
        name: 'Pedro Garcia',
        email: 'pedro@email.com',
        password: hashedPassword,
        userType: 'family',
        contactNumber: '09221234567',
        location: {
          type: 'Point',
          coordinates: [123.1795, 13.6225]
        },
        address: 'Barangay Concepcion Grande, Naga City',
        status: 'active',
        isVerified: true
      },

      // Admin account
      {
        name: 'System Admin',
        email: 'admin@naga.gov.ph',
        password: hashedPassword,
        userType: 'admin',
        contactNumber: '09301234567',
        location: {
          type: 'Point',
          coordinates: [123.1816, 13.6218]
        },
        address: 'Naga City Government, Panganiban Drive, Naga City',
        status: 'active',
        isVerified: true
      }
    ]);

    console.log(`Created ${users.length} users`);

    // Create sample alerts
    const alerts = await Alert.create([
      {
        title: 'Chest Pain - Need Urgent Medical Help',
        reporter: users.find(u => u.userType === 'citizen')._id,
        type: 'hospital',
        priority: 'high',
        description: 'Need immediate medical assistance - chest pain',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [123.1830, 13.6200]
          },
          address: 'Barangay Dinaga, Naga City'
        },
        status: 'pending',
        timeline: [
          {
            action: 'Emergency reported',
            timestamp: new Date()
          }
        ]
      },
      {
        title: 'Robbery in Progress',
        reporter: users.find(u => u.email === 'maria@email.com')._id,
        type: 'police',
        priority: 'critical',
        description: 'Robbery in progress at convenience store',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [123.1870, 13.6180]
          },
          address: 'Carolina Shopping Center, Naga City'
        },
        status: 'active',
        responder: users.find(u => u.email === 'police1@naga.gov.ph')._id,
        responseTime: new Date(Date.now() - 120000),
        timeline: [
          {
            action: 'Emergency reported',
            timestamp: new Date(Date.now() - 300000)
          },
          {
            action: 'Officer dispatched to location',
            user: users.find(u => u.email === 'police1@naga.gov.ph')._id,
            timestamp: new Date(Date.now() - 120000)
          }
        ]
      },
      {
        title: 'House Fire - Family Trapped',
        reporter: users.find(u => u.userType === 'family')._id,
        type: 'fire',
        priority: 'critical',
        description: 'House fire - family trapped inside',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [123.1795, 13.6225]
          },
          address: '123 Rizal Street, Concepcion Grande, Naga City'
        },
        status: 'responded',
        responder: users.find(u => u.userType === 'fire')._id,
        responseTime: new Date(Date.now() - 480000),
        timeline: [
          {
            action: 'Fire emergency reported',
            timestamp: new Date(Date.now() - 600000)
          },
          {
            action: 'Fire truck en route',
            user: users.find(u => u.userType === 'fire')._id,
            timestamp: new Date(Date.now() - 480000)
          },
          {
            action: 'Fire crew on scene, evacuating residents',
            user: users.find(u => u.userType === 'fire')._id,
            timestamp: new Date(Date.now() - 300000)
          }
        ]
      },
      {
        title: 'Vehicle Collision',
        reporter: users.find(u => u.email === 'juan@email.com')._id,
        type: 'police',
        priority: 'medium',
        description: 'Minor vehicle collision, no injuries',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [123.1810, 13.6205]
          },
          address: 'Magsaysay Avenue corner Peñafrancia, Naga City'
        },
        status: 'resolved',
        responder: users.find(u => u.email === 'police2@naga.gov.ph')._id,
        responseTime: new Date(Date.now() - 6900000),
        resolvedTime: new Date(Date.now() - 5400000),
        timeline: [
          {
            action: 'Traffic accident reported',
            timestamp: new Date(Date.now() - 7200000)
          },
          {
            action: 'Traffic officer responding',
            user: users.find(u => u.email === 'police2@naga.gov.ph')._id,
            timestamp: new Date(Date.now() - 6900000)
          },
          {
            action: 'Officer on scene, documenting accident',
            user: users.find(u => u.email === 'police2@naga.gov.ph')._id,
            timestamp: new Date(Date.now() - 6600000)
          },
          {
            action: 'Accident cleared, vehicles towed',
            user: users.find(u => u.email === 'police2@naga.gov.ph')._id,
            timestamp: new Date(Date.now() - 5400000)
          }
        ]
      },
      {
        title: 'Stray Dogs Disturbance',
        reporter: users.find(u => u.email === 'pedro@email.com')._id,
        type: 'police',
        priority: 'low',
        description: 'Stray dogs causing disturbance',
        location: {
          coordinates: {
            type: 'Point',
            coordinates: [123.1845, 13.6195]
          },
          address: 'Barangay Triangulo, Naga City'
        },
        status: 'pending',
        timeline: [
          {
            action: 'Animal control needed',
            timestamp: new Date(Date.now() - 1800000)
          }
        ]
      }
    ]);

    console.log(`Created ${alerts.length} alerts`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest Accounts:');
    console.log('=====================================');
    console.log('Police: police1@naga.gov.ph / password123');
    console.log('Police: police2@naga.gov.ph / password123');
    console.log('Hospital: bmc@hospital.ph / password123');
    console.log('Hospital: ncgh@hospital.ph / password123');
    console.log('Fire: fire@naga.gov.ph / password123');
    console.log('Citizen: juan@email.com / password123');
    console.log('Citizen: maria@email.com / password123');
    console.log('Family: pedro@email.com / password123');
    console.log('Admin: admin@naga.gov.ph / password123');
    console.log('=====================================\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedData();
