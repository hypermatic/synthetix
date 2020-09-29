require('dotenv').config();

const program = require('commander');
const bre = require('@nomiclabs/buidler');
const { green, cyan, red } = require('chalk');

const { getContract } = require('./utils/getContract');
const { setupProvider } = require('./utils/setupProvider');

async function status({
	network,
	useOvm,
	providerUrl,
}) {
	/* ~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~~~ Input ~~~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~ */

	providerUrl = providerUrl.replace('network', network);
	if (!providerUrl) throw new Error('Cannot set up a provider.')

	/* ~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~~~ Setup ~~~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~ */

	const { provider } = await setupProvider({ providerUrl });

	/* ~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~ Log utils ~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~ */

	const logSection = (sectionName) => {
		console.log(green(`\n=== ${sectionName}: ===`));
	};

	const logItem = (itemName, itemValue, indent = 1) => {
		const spaces = ' '.repeat(indent);
		const name = cyan(`* ${itemName}${itemValue ? ':' : ''}`);
		const value = itemValue ? itemValue : '';
		console.log(spaces, name, value);
	}

	/* ~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~~ General ~~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~ */

	logSection('Info');

	logItem('Network', network);
	logItem('Optimism', useOvm);
	logItem('Provider', providerUrl);

	/* ~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~ Synthetix ~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~ */

	logSection('Synthetix');

	const Synthetix = await getContract({
		contract: 'Synthetix',
		network,
		useOvm,
		provider,
	});

	logItem(
		'Synthetix.anySynthOrSNXRateIsInvalid:',
		await Synthetix.anySynthOrSNXRateIsInvalid()
	);
	logItem('Synthetix.totalSupply', (await Synthetix.totalSupply()).toString() / 1e18);

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~ FixedSupplySchedule (Optimism) ~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

	if (useOvm) {
		logSection('FixedSupplySchedule');

		const FixedSupplySchedule = await getContract({
			contract: 'SupplySchedule',
			abi: 'FixedSupplySchedule',
			network,
			useOvm,
			provider,
		});

		logItem(
			'FixedSupplySchedule.inflationStartDate',
			new Date((await FixedSupplySchedule.inflationStartDate()).toString() * 1000)
		);

		const supply = bre.ethers.utils.formatEther(await FixedSupplySchedule.mintableSupply());
		logItem('FixedSupplySchedule.mintableSupply', supply);

		const lastMint = (await FixedSupplySchedule.lastMintEvent()).toNumber();
		logItem('FixedSupplySchedule.lastMintEvent', lastMint);
		const mintPeriod = (await FixedSupplySchedule.mintPeriodDuration()).toNumber();
		logItem('FixedSupplySchedule.mintPeriodDuration', mintPeriod);

		const now = Math.floor(new Date().getTime() / 1000);

		const remainingHours = (lastMint + mintPeriod - now) / (60 * 60);
		logItem('Remaining hours until period ends', remainingHours);

		logItem(
			'FixedSupplySchedule.mintBuffer',
			(await FixedSupplySchedule.mintBuffer()).toString()
		);
		logItem(
			'FixedSupplySchedule.periodsSinceLastIssuance',
			(await FixedSupplySchedule.periodsSinceLastIssuance()).toString()
		);
	}

	/* ~~~~~~~~~~~~~~~~~ */
	/* ~~~~ FeePool ~~~~ */
	/* ~~~~~~~~~~~~~~~~~ */

	logSection('FeePool');

	const FeePool = await getContract({
		contract: 'FeePool',
		network,
		useOvm,
		provider,
	});

	logItem('FeePool.feePeriodDuration', (await FeePool.feePeriodDuration()).toString());

	const feePeriod0 = await FeePool.recentFeePeriods('0');
	logItem('feePeriod0');
	Object.keys(feePeriod0).map((key) => {
		if (isNaN(key)) {
			logItem(`${key}`, `${feePeriod0[key].toString()}`, 2);
		}
	});

	logItem(
		'feePeriod0.recentFeePeriods(0).startTime',
		new Date(feePeriod0.startTime.toString() * 1000),
		2
	);

	/* ~~~~~~~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~ AddressResolver ~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~~~~~~~ */

	logSection('AddressResolver');

	const AddressResolver = await getContract({
		contract: 'AddressResolver',
		network,
		useOvm,
		provider,
	});

	const getAddress = async ({ contract }) => {
		logItem(
			`AddressResolver.getAddress(${contract})`,
			await AddressResolver.getAddress(bre.ethers.utils.formatBytes32String(contract))
		);
	};

	await getAddress({ contract: 'RewardsDistribution' });

	/* ~~~~~~~~~~~~~~~~~~~~~~~ */
	/* ~~~~ ExchangeRates ~~~~ */
	/* ~~~~~~~~~~~~~~~~~~~~~~~ */

	logSection('ExchangeRates');

	const ExchangeRates = await getContract({
		contract: 'ExchangeRates',
		network,
		useOvm,
		provider,
	});

	const logRate = async (currency) => {
		const rate = await ExchangeRates.rateForCurrency(bre.ethers.utils.formatBytes32String('SNX'));
		const updated = (await ExchangeRates.lastRateUpdateTimes(bre.ethers.utils.formatBytes32String('SNX'))) * 1000;
		logItem(`${currency} rate:`, `${rate} (updated ${updated})`);
	};

	await logRate('SNX');
}
program
	.description('Query state of the system on any network')
	.option('-n, --network <value>', 'The network to run off.', x => x.toLowerCase(), 'mainnet')
	.option('-p, --provider-url <value>', 'The http provider to use for communicating with the blockchain',
		process.env.PROVIDER_URL
	)
	.option('-z, --use-ovm', 'Use an Optimism chain', false)
	.action(async (...args) => {
		try {
			await status(...args);
		} catch (err) {
			console.error(red(err));
			console.log(err.stack);

			process.exitCode = 1;
		}
	});

if (require.main === module) {
	require('pretty-error').start();

	program.parse(process.argv);
}
