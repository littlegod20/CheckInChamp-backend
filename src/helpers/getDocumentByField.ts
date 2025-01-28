// import { connectDB } from '../config/database';
// import mongoose from 'mongoose';
// import { Team } from '../models/Team';

// // import { MongoClient, Db, Collection } from 'mongodb';

// async function getTeamByField(
//   collectionName: string,
//   fieldName: string,
//   fieldValue: any
// ): Promise<any> {
//   // const client = new MongoClient(uri);

//   try {

//     const team = await Team.findOne({ name: 'team1' });
    

//     const query = { [fieldName]: fieldValue };
//     const document = await collection.findOne(query);

//     return document;
//   } catch (error) {
//     console.error('Error getting document by field:', error);
//     throw error;
//   } finally {
//     await client.close();
//   }
// }

// export default getDocumentByField;