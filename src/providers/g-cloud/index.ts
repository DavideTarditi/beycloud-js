import { Bucket, File, Storage } from "@google-cloud/storage"
import { Readable } from "stream"
import { CloudStorage } from "../../types/cloud"
import { GCSConfig } from "../../types/config"
import { FileMetadata } from "../../types/metadata"

export class GCSService extends CloudStorage {
    private readonly client: Storage
    private readonly bucket: Bucket

    constructor(config: GCSConfig) {
        super()

        if (config.bucket == null)
            throw new Error("Bucket must be provided")

        if (config.projectId == null)
            throw new Error("Project must be provided")

        if (config.keyFilePath == null)
            throw new Error("Key File Path must be provided")

        this.client = new Storage({ projectId: config.projectId, keyFile: config.keyFilePath })
        this.bucket = this.client.bucket(config.bucket)
    }

    async exists(key: string): Promise<boolean> {
        try {
            const file = this.bucket.file(key)
            const [exists] = await file.exists()
            return exists
        } catch (error: any) {
            throw new Error(`Failed to check if file exists: ${error.message}`)
        }
    }

    async uploadFile(
        key: string,
        file: Buffer | Readable,
        contentType?: string
    ): Promise<string> {
        try {
            const fileHandle = this.bucket.file(key)
            const options: { contentType?: string } = {}
            if (contentType) options.contentType = contentType

            const stream = fileHandle.createWriteStream(options)
            if (file instanceof Buffer) {
                stream.end(file)
            } else {
                file.pipe(stream)
            }

            await new Promise((resolve, reject) => {
                stream.on("finish", resolve)
                stream.on("error", reject)
            })

            return this.getSignedUrl(key)
        } catch (error: any) {
            throw new Error(`Failed to upload file: ${error.message}`)
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        try {
            const fileHandle: File = this.bucket.file(key)
            const [data] = await fileHandle.download()
            return data
        } catch (error: any) {
            throw new Error(`Failed to download file: ${error.message}`)
        }
    }

    async deleteFile(key: string): Promise<boolean> {
        try {
            const fileHandle = this.bucket.file(key)
            await fileHandle.delete()

            return true
        } catch (error: any) {
            throw new Error(`Failed to delete file: ${error.message}`)
        }
    }

    async getFile(key: string): Promise<FileMetadata> {
        try {
            const fileHandle: File = this.bucket.file(key)
            const [metadata] = await fileHandle.getMetadata()
            const data: Buffer = await this.downloadFile(key)

            return {
                key: key,
                size: Number(metadata.size),
                lastModified: new Date(metadata.updated),
                type: metadata.type,
                url: await this.getSignedUrl(key)
            }
        } catch (error: any) {
            throw new Error(`Failed to get file: ${error.message}`)
        }
    }

    async getFilesList(maxKeys: number = 1000, prefix?: string): Promise<FileMetadata[]> {
        try {
            const [files] = await this.bucket.getFiles({
                prefix,
                maxResults: maxKeys
            })

            return []

            // TODO: map file metadata

            // return files.map<FileMetadata>(async (file) => ({
            //     key: file.name,
            //     size: Number(file.metadata.size),
            //     lastModified: new Date(file.metadata.updated),
            //     url: await this.getSignedUrl(file.name)
            // }))
        } catch (error: any) {
            throw new Error(`Failed to list files: ${error.message}`)
        }
    }

    async getSignedUrl(key: string, expiresIn: number = 3600) {
        try {
            const fileHandle = this.bucket.file(key)

            const [url] = await fileHandle.getSignedUrl({
                action: "read",
                expires: Date.now() + expiresIn * 1000
            })

            return url[0]
        } catch (error: any) {
            throw new Error(`Failed to generate signed URL: ${error.message}`)
        }
    }
}
