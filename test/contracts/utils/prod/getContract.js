const { artifacts } = require('@nomiclabs/buidler');
const { getTarget } = require('../../../../index.js');

async function connectContract({ network, contractName, abiName = contractName }) {
	const { address } = getTarget({ network, contract: contractName });
	const Contract = artifacts.require(abiName);

	return Contract.at(address);
}

async function connectContracts({ network, requests }) {
	const contracts = {};

	await Promise.all(
		requests.map(async ({ contractName, abiName = contractName }) => {
			contracts[abiName] = await connectContract({
				network,
				contractName,
				abiName,
			});
		})
	);

	return contracts;
}

module.exports = {
	connectContract,
	connectContracts,
};
