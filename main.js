Apify = require('apify');
cfg = require('./weathscr/config.js');

async function main() {
    Apify.main(async () => {
        const citiesDataset = await Apify.openDataset(cfg.DATASET_CITIES);
        let cityData = await citiesDataset.getData();

        if (cityData.items.length === 0) {
            console.log('No city list, fetching...');

            const cityInfos = await require('./weathscr/cities.js').run(cfg.CONCURENCY_MIN, cfg.CONCURENCY_MAX);

            console.log(`Fetched ${cityInfos.length} city information.`);

            await citiesDataset.pushData({'cities': cityInfos});

            console.log(`City list fetched, got ${cityInfos.length} cities.`);

            cityData = await citiesDataset.getData();
        }

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