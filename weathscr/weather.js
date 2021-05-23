const Apify = require('apify');
const {RequestList} = require("apify");


module.exports.run = async (cityList, minConcurrency, maxConcurrency) => {
    const urls = [];
    cityList.forEach((c) => {
        urls.push(c['url']);
    });

    const requestList = new RequestList({sources: urls});
    await requestList.initialize()

    let counter = 0
    const maxCities = urls.length;
    const weather = {};
    const crawler = new Apify.CheerioCrawler({
        requestList,
        minConcurrency: minConcurrency,
        maxConcurrency: maxConcurrency,
        handlePageFunction: async ({$}) => {
            const cityName = $('title').text().split(',')[0].substr(7);
            const top = $('.d_h9');
            const days = [];
            top.find('strong').each((i, element) => {
                let temp = $(element).text();
                temp = Number(temp.substr(0, temp.length - 2));
                days.push(temp);
            });
            weather[cityName] = days;

            counter++;
            console.log(`Fetched ${cityName} ${counter}/${maxCities} ${(counter / maxCities * 100).toFixed(2)}%`);
        },
        handleFailedRequestFunction: async () => {

        }
    });
    await crawler.run();

    return weather;
}
