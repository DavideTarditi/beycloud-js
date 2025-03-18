import { AzureConfig, BeyCloud, CloudStorage, GCSConfig } from '../../src'
import * as fs from 'fs'
import * as path from 'node:path'

describe('Azure', () => {
    const rootTestFolder = path.resolve(__dirname, '..')

    let client: CloudStorage
    let config: AzureConfig

    beforeEach(() => {
        config = {
            connectionString: process.env.AZURE_CONNECTION_STRING as string,
            container: process.env.AZURE_CONTAINER as string
        }

        try {
            client = new BeyCloud('azure', config)
        } catch (err) {
            process.exit(1)
        }
    })

    describe('Configuration', () => {
        test('Missed configuration part', () => {
            const incorrectConfig: AzureConfig = {
                connectionString: process.env.AZURE_CONNECTION_STRING as string,
                container: ''
            }

            expect(() => {
                const testLocalClient = new BeyCloud('azure', incorrectConfig)
            }).toThrow('Container parameter must be provided')
        })

        test('Incorrect configuration', () => {
            /* Providing Google Cloud config instead Azure */
            const incorrectConfig: GCSConfig = {
                bucket: process.env.GCS_BUCKET as string,
                projectId: process.env.GCS_PROJECTID as string,
                keyFilePath: path.join(rootTestFolder, 'key/account.json')
            }

            expect(() => {
                const testLocalClient = new BeyCloud('azure', incorrectConfig)
            }).toThrow('Azure credentials credentials are required. Configuration is incorrect or must be provided')
        })
    })

    describe('Upload', () => {
        test('Upload photo correctly', async () => {
            const fileContent = fs.readFileSync(path.join(rootTestFolder, 'sample/skyline.jpg'))

            const url: string = await client.uploadFile('skyline', fileContent)

            const expectedUrl = process.env.AZURE_EXPECTED_URL as string

            expect(url.startsWith(expectedUrl)).toBe(true)
        })
    })

    describe('Download', () => {
        test('Download photo correctly', async () => {
            await client.downloadFile('skyline')
        })

        test('Download photo not correct', async () => {
            await expect(async () => {
                await client.downloadFile('skyline2')
            }).rejects.toThrowError('Failed to download file: The specified key does not exist.')
        })
    })

    describe('Get files', () => {
        test('Get single file', async () => {
            const receivedFile = await client.getFile('skyline')

            expect(receivedFile.size?.toString()).toMatch('383767')
        })

        test('Get files array', async () => {
            const receivedFiles = await client.getFilesList()

            expect(receivedFiles.length.toString()).toMatch('1')
        })

        test('Get single file - uncorrected key', async () => {
            await expect(client.getFile('inexistent_folder/skyline.png')).rejects.toThrowError(
                'Failed to get file: The specified key does not exist.'
            )
        })
    })

    describe('Signed URL', () => {
        test('Get url', async () => {
            const expectedUrl = process.env.AZURE_EXPECTED_URL as string

            const url = await client.getSignedUrl('skyline', 2500)

            expect(url.startsWith(expectedUrl)).toBe(true)
        })
    })

    describe('Delete', () => {
        test('Delete photo correctly', async () => {
            expect(await client.deleteFile('skyline')).toBe(true)
        })

        test('Delete photo - uncorrected key', async () => {
            await expect(client.deleteFile('skyline2')).rejects.toThrowError('Failed to delete file: The specified key does not exist.')
        })
    })
})
