import { useEffect, useRef } from 'react';
import { genKeyPairFromSeed, SkynetClient } from 'skynet-js';

interface NFT {
    name: string;
    description: string;
    image: string;
}

// SkyDB document shape -- https://www.notion.so/fdotinc/OpenApe-ce6504e20ca14d38bdb1d879bc33830b#7ee0a3d6f8d54b479d644fd55d65fe16

// Hook with default skyDB settings
export function useDefaultSkyDB(): any {
    return useSkyDB('Open Ape datastore', process.env.NEXT_PUBLIC_SKYDB_SEED || '');
}

export default function useSkyDB(dataKey: string, seed: string): any {
    // ===== SKYLINK / SKYNET =====
    const skyPortalRef = useRef<any>();
    const skydbPrivateKey = useRef<any>();
    const skydbPublicKey = useRef<any>();

    // Initialize skyDB client
    useEffect(() => {
        const portal = 'https://siasky.net/';
        skyPortalRef.current = new SkynetClient(portal);

        const { privateKey, publicKey } = genKeyPairFromSeed(seed);

        skydbPrivateKey.current = privateKey;
        skydbPublicKey.current = publicKey;
    }, [seed]);

    // CAUTION: Function to directly upload JSON to skyDB, DOES NOT CHECK validity
    const uploadToSkyDB = async (document: Record<string, any>) => {
        try {
            await skyPortalRef.current.db.setJSON(skydbPrivateKey.current, dataKey, document);

            // console.log("Uploading to SkyDB: ", document);
        } catch (error) {
            console.log(error);
        }
    };

    // Function to get all data from skyDB as JSON (not exported)
    const getDataFromSkyDB = async () => {
        // console.log("Calling getDataFromSkyDB")
        try {
            const { data, revision } = await skyPortalRef.current.db.getJSON(
                skydbPublicKey.current,
                dataKey,
            );

            // console.log("Data from SkyDB: ", data);
            // console.log("Revisions to SkyDB: ", revision);

            return data;
        } catch (error) {
            console.log(error);
        }
    };

    // Return the JSON data pertaining to a specific user
    const getUser = async (publicAddress: string) => {
        const data = await getDataFromSkyDB();

        if (Object.keys(data).includes(publicAddress)) {
            return data[publicAddress];
        } else {
            // console.log(
            //   "Error: there is no user with that public address in the database"
            // );
            return null;
        }
    };

    const getUserByUsername = async (username: string) => {
        const data = await getDataFromSkyDB();

        // Get all addresses with given username
        const publicAddresses = Object.keys(data).filter((key) => data[key].username === username);

        if (publicAddresses.length) {
            const publicAddress = publicAddresses[0];
            // Return user data and public address
            return {
                ...data[publicAddress],
                publicAddress,
            };
        } else {
            // console.log("Error: there is no user with that username in the database");
        }
    };

    // Onboard a user to the database
    // Visit the link at the top of the file for the SkyDB document shape.
    const onboardUser = async (publicAddress: string) => {
        const data = await getDataFromSkyDB();

        // If the public address isn't already in the database, onboard them
        if (!data || !data[publicAddress]) {
            const document = {
                ...data,
                [publicAddress]: {
                    username: '',
                    transactions: [],
                    collections: {},
                },
            };

            await uploadToSkyDB(document);
        } else {
            // console.log("Error: that public address is already in the database");
        }
    };

    // Visit the link at the top of the file for the SkyDB document shape.
    const updateUserNFTs = async (publicAddress: string, contractAddress: string, nftObj: NFT) => {
        const data = await getDataFromSkyDB();
        const document = data ? { ...data } : {};

        if (document[publicAddress]) {
            if (document[publicAddress].collections[contractAddress]) {
                document[publicAddress].collections[contractAddress][nftObj.image] = nftObj;
            } else {
                document[publicAddress].collections[contractAddress] = {};
                document[publicAddress].collections[contractAddress][nftObj.image] = nftObj;
            }
        } else {
            document[publicAddress] = {};
            document[publicAddress].collections[contractAddress] = {};
            document[publicAddress].collections[contractAddress][nftObj.image] = nftObj;
        }

        await uploadToSkyDB(document);
    };

    // Visit the link at the top of the file for the SkyDB document shape.
    const getNFTsOfCollection = async (publicAddress: string, contractAddress: string) => {
        const data = await getDataFromSkyDB();
        if (data && data[publicAddress]) {
            return data[publicAddress].collections[contractAddress];
        } else {
            return null;
        }
    };

    // Visit the link at the top of the file for the SkyDB document shape.
    const getAllCollections = async (publicAddress: string) => {
        const data = await getDataFromSkyDB();
        if (data && data[publicAddress]) {
            return data[publicAddress].collections;
        } else {
            return null;
        }
    };

    // const getUserByUsername = async (username: string) => {
    //     const data = await getDataFromSkyDB();

    //     // Get all addresses with given username
    //     const publicAddresses = Object.keys(data).filter((key) => data[key].username === username);

    //     if (publicAddresses.length) {
    //         const publicAddress = publicAddresses[0];
    //         // Return user data and public address
    //         return {
    //             ...data[publicAddress],
    //             publicAddress,
    //         };
    //     } else {
    //         // console.log("Error: there is no user with that username in the database");
    //     }
    // };

    const getCollectionByCollectionTitle = async (
        publicAddress: string,
        collectionTitle: string,
    ) => {
        const data = await getDataFromSkyDB();
        const document = data;

        const collectionsOfUser = await getAllCollections(publicAddress);
        const targetCollectionAddress = Object.keys(collectionsOfUser).filter((contractAddress) => {
            return collectionsOfUser[contractAddress].title === collectionTitle;
        });

        if (targetCollectionAddress.length) {
            const collectionAddress = targetCollectionAddress[0];
            return document[publicAddress].collections[collectionAddress];
        } else {
            console.error(`The user has no collection titled ${collectionTitle}`);
        }
    };

    // Update a users fields in DB
    const updateUser = async (publicAddress: string, updates: Record<string, any>) => {
        const data = await getDataFromSkyDB();

        // If the public address is already in the database, update it
        if (data && data[publicAddress]) {
            const document = {
                ...data,
                [publicAddress]: {
                    ...data[publicAddress],
                    ...updates,
                },
            };

            await uploadToSkyDB(document);
        } else {
            // console.log("Error: that public addess is not in the database");
        }
    };

    // Add transaction log to DB
    const logTransaction = async (publicAddress: string, hash: any) => {
        const data = await getDataFromSkyDB();

        if (data && data[publicAddress]) {
            const field = data[publicAddress].transactions;
            const logs = field && field.length ? field : [];

            const document = {
                ...data,
                [publicAddress]: {
                    ...data[publicAddress],
                    transactions: logs.includes(hash) ? [...logs] : [...logs, hash],
                },
            };

            await uploadToSkyDB(document);
        } else {
            // console.log("Error: that public address is not in the database");
        }
    };

    // Add transaction log to DB
    const logContractAddress = async (publicAddress: string, contractAddress: any) => {
        const data = await getDataFromSkyDB();

        if (data !== undefined && data[publicAddress] !== undefined) {
            const field = data[publicAddress].NFTs;
            const logs = field && field.length ? field : [];

            const document = {
                ...data,
                [publicAddress]: {
                    ...data[publicAddress],
                    NFTs: [...logs, contractAddress],
                },
            };

            // console.log("New document: ", document)

            await uploadToSkyDB(document);
        } else {
            // console.log("Error: that public address is not in the database");
        }
    };

    return {
        getDataFromSkyDB,
        getUser,
        getUserByUsername,
        onboardUser,
        updateUser,
        logTransaction,
        logContractAddress,
        updateUserNFTs,
        getNFTsOfCollection,
        getAllCollections,
        getCollectionByCollectionTitle,
    };
}
