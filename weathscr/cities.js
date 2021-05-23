const Apify = require('apify');
const {RequestList} = require("apify");
const urls = require('./urls.js')


function formatString(str, arguments) {
    for (let i in arguments) {
        str = str.replace("{" + i + "}", arguments[i])
    }
    return str
}

async function fetchCityList() {
    console.log('Fetching city list from wikipedia...')

    const requestList = new RequestList({sources: [urls.CITY_LIST_URL]});
    await requestList.initialize();

    const cityList = [];
    const crawler = new Apify.CheerioCrawler({
        requestList,
        handlePageFunction: async ({$}) => {
            $('.mw-parser-output > table > tbody > tr > td > ul > li').each((i, val) => {
                cityList.push($(val).text())
            });
        }
    });
    await crawler.run();

    return cityList;
}

async function fetchCityInfos(cityList, minConcurrency, maxConcurrency) {
    console.log('Fetching city info from seznam.cz API...')

    const apiUrlList = [];
    cityList.forEach((c) => {
        apiUrlList.push(formatString(urls.SEZNAM_SEARCH_API_URL, [encodeURIComponent(c)]))
    });

    const requestList = new RequestList({sources: apiUrlList});
    await requestList.initialize();

    let counter = 0
    const maxCities = cityList.length;
    const cities = []
    const crawler = new Apify.CheerioCrawler({
        requestList,
        minConcurrency: minConcurrency,
        maxConcurrency: maxConcurrency,
        handlePageFunction: async ({body}) => {
            const cityData = JSON.parse(body.toString())['result'][0]['userData'];
            const cityName = cityData['suggestFirstRow'];
            cities.push({
                'name': cityName,
                'lat': cityData['latitude'],
                'lon': cityData['longitude'],
                'url': formatString(
                    urls.SEZNAM_CITY_WEATHER_URL,
                    [
                        encodeURIComponent(cityName.toLowerCase()),
                        cityData['source'],
                        cityData['id']
                    ]
                )
            });
            counter++;
            console.log(`Fetched ${counter}/${maxCities} ${(counter / maxCities * 100).toFixed(2)}%`);
        },
    });
    await crawler.run()

    return cities
}

module.exports.run = async (minConcurrency, maxConcurrency) => {
    const cityList = await fetchCityList();
    return await fetchCityInfos(cityList, minConcurrency, maxConcurrency);
}

