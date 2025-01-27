//configure redis connection
import {createClient} from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redis_host = process.env.REDIS_HOST;
let redis_port = process.env.REDIS_PORT;

export const redisClient = createClient({
    url: `redis://${redis_host}:${redis_port}`,
});
