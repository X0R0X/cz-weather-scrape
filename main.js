Apify = require('apify');
cfg = require('./weathscr/config.js');

async function main() {
    Apify.main(async () => {
        const citiesDataset = await Apify.openDataset(cfg.DATASET_CITIES);
        let cityData = await citiesDataset.getData();

        // Fetch list of czech cities from wikipedia and then use pocasi.seznam.cz autocomplete search API to
        // get city data (geolocation) and proper url. I just take the first result, so the city list doesn't exactly
        // reflect the list from wikipedia due to possible name collisions. We do this only once (on the first run).
        if (cityData.items.length === 0) {
            console.log('No city list, fetching...');

            const cityInfos = await require('./weathscr/cities.js').run(cfg.CONCURENCY_MIN, cfg.CONCURENCY_MAX);

            console.log(`Fetched ${cityInfos.length} city information.`);

            await citiesDataset.pushData({'cities': cityInfos});

            console.log(`City list fetched, got ${cityInfos.length} cities.`);

            cityData = await citiesDataset.getData();
        }

        // Scrape weather forecast for our city list. We get the forecast for `today` and next 5 days. After a while
        // (at cca 95% progress) seznam API gets pissed and starts to return HTTP GOAWAY. We just wait for a while and
        // repeat the scraping for urls that errored - no need for proxy shenanigans.
        const cityList = cityData.items[0]['cities'];

        console.log(`Scraping weather for ${cityList.length} cities...`);

        const weatherData = await require('./weathscr/weather.js').run(
            cityList, cfg.CONCURENCY_MIN, cfg.CONCURENCY_MAX
        );

        const weatherDataset = await Apify.openDataset(cfg.DATASET_WATHER);
        await weatherDataset.pushData(weatherData);

        console.log(`Weather data scraped for ${Object.keys(weatherData).length} cities.`);
    })
}

main().then().catch(console.error);