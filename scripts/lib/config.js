const FIRST_YEAR = 1895;
const CURRENT_YEAR = Number(process.env.FILM_YEAR) || new Date().getFullYear();
const TOP_N = 30;
const CN_N = 20;
const ALL_TIME_RATIO = 0.1;

module.exports = { FIRST_YEAR, CURRENT_YEAR, TOP_N, CN_N, ALL_TIME_RATIO };
