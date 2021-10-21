import { fileURLToPath, pathToFileURL } from 'url';

import fsApi from 'fs';
import path from 'path';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_PATH = path.resolve(__dirname, 'snapshots.json');

import { MongoClient } from 'mongodb';
import { exit } from 'process';
const url = 'mongodb://localhost:27017';

(async () => {
  console.time();
  const client = new MongoClient(url);
  const dbName = 'OTA';

  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection('snapshots');

  // const snapshosts = JSON.parse(await fs.readFile(SNAPSHOTS_PATH));

  function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  // for (let index = 0; index < 250000; index++) {
  //   const { serviceId, documentType, content, fileExtension, changelog, authorDate } = snapshosts[index % 10000];
  //   const insertResult = await collection.insertOne({ serviceId, documentType, content, fileExtension, changelog, authorDate: randomDate(new Date(2010, 0, 1), new Date()) });
  //   if (index % 1000 == 0) {
  //     console.log(index, 'inserted');
  //   }
  // }

  // console.timeEnd();
  // console.log('insertion finished');

  // console.time('findOnePreciseDate');
  // const doc = await collection.findOne({serviceId:'AccuWeather', documentType: 'Privacy Policy', authorDate: { $gte : new Date("2010-01-01T16:20:15.750Z") } });
  // console.log(doc);
  // console.timeEnd('findOnePreciseDate');

  const services = ['AccuWeather', 'Intuit', 'Ancestry', 'Directv', 'Amazon.com', 'Womans Day', 'Bestbuy'];
  const types = ['Terms of service', 'Privacy Policy'];

  let r = 0;
  const max = 1000;
   for (let index = 0; index < max; index++) {
    const start = Date.now()
    console.time('findOnePreciseDate');
    const doc = await collection.findOne({serviceId: services[index % 6], documentType: 'Privacy Policy', authorDate: { $gte : randomDate(new Date(2010, 0, 1), new Date()) } });
    const stop = Date.now()
    const time = stop - start;
    r += time;
    console.log(doc?._id);
    console.timeEnd('findOnePreciseDate');
  }

  console.log('average', r/max);
  // console.time('findDocuments');
  // const findDocuments = await collection.find({serviceId:'AccuWeather', documentType: 'Privacy Policy' }).toArray();
  // console.log(findDocuments.length);
  // console.timeEnd('findDocuments');

  // console.time('findService');
  // const findService = await collection.find({serviceId:'AccuWeather' }).toArray();
  // console.log(findService.length);
  // console.timeEnd('findService');

  // console.time('getWholeCollectionSorted');
  // // const getWholeCollectionSorted = await collection.find({ $query: {}, $orderby: { authorDate : -1 } });
  // const cursor = collection.find({}).sort( { authorDate : 1 } );
  // console.log("async");
  // let i = 0;
  // console.time('process');
  // for await (const doc of cursor) {
  //   console.timeLog('process');
  //   // console.log(i++, doc.authorDate);
  // }
  // console.timeEnd('process');

  // // console.log(getWholeCollectionSorted);
  // console.timeEnd('getWholeCollectionSorted');

})();
