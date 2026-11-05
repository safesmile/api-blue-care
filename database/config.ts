import { databaseOptions } from "./connection";
const configurations = { development: databaseOptions(), test: databaseOptions(), production: databaseOptions() };
export = configurations;
