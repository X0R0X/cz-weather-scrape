const Apify = require('apify');
const {RequestList} = require("apify");
const sleep = require('sleep-promise');
const cfg = require('./config.js');


async function runCrawler(requestList, minConcurrency, maxConcurrency) {
    let counter = 0
    const maxCities = requestList.length();
    let erroredUrls = [];
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
            if (cfg.LOG_PROGRESS) {
                console.log(
                    `Fetched ${cityName} ${counter}/${maxCities} ${(counter / maxCities * 100).toFixed(2)}%`
                );
            }
        },
        handleFailedRequestFunction: async ({request,error}) => {
            // As far as I know, the server just closed connection and I haven't found any other way to compare the
            // error.
            if (error.message === 'New streams cannot be created after receiving a GOAWAY') {
                erroredUrls.push(request.url);
                console.log(`Error '${error.message}' for url ${request.url}, added to errored urls.`);
            } else {
                console.log(`Error '${error.message} for url ${request.url} !`);
            }
        }
    });
    await crawler.run();

    return {
        'weather': weather,
        'erroredUrls': erroredUrls
    }
}


module.exports.run = async (cityList, minConcurrency, maxConcurrency) => {
    const urls = [];
    cityList.forEach((c) => {
        urls.push(c['url']);
    });

    let requestList = new RequestList({sources: urls});
    await requestList.initialize()

    let result = await runCrawler(requestList, minConcurrency, maxConcurrency);
    let weather = result['weather'];
    while (true) {
        const erroredUrls = result['erroredUrls']
        if (erroredUrls.length === 0) {
            break;
        } else {
            let requestList = new RequestList({sources: erroredUrls});
            await requestList.initialize()
            console.log(
                `There were ${erroredUrls.length} errors during scraping (${Object.keys(weather).length} OK)), ` +
                `waiting for ${cfg.SLEEP_ON_GOAWAY}ms and running again.`
            );

            await sleep(cfg.SLEEP_ON_GOAWAY);

            result = await runCrawler(requestList, minConcurrency, maxConcurrency);
            weather = Object.assign({}, weather, result['weather']);
        }
    }
    return weather;
}
