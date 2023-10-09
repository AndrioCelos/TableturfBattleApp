declare class TarFile {
	name: string;
	mode: string;
	uid: number;
	gid: number;
	size: number;
	mtime: number;
	checksum: number;
	type: string;
	linkname: string;
	ustarFormat: string;

	version?: string;
	uname?: string;
	gname?: string;
	devmajor?: number;
	devminor?: number;
	namePrefix?: string;

	buffer: ArrayBuffer;
	blob: Blob;
	getBlobUrl(): string;
	readAsString(): string;
	readAsJSON(): object;
}

declare class ProgressivePromise<TResult, TProgress> extends Promise<TResult> {
	progress(cb: ((value: TProgress) => void)): ProgressivePromise<TResult, TProgress>;
	then<TResult1 = TResult, TResult2 = never>(
		onfulfilled?: ((value: TResult) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		onProgress?: ((value: TProgress) => void) | undefined | null)
		: ProgressivePromise<TResult1 | TResult2, TProgress>;
}

declare function untar(arrayBuffer: ArrayBuffer): ProgressivePromise<TarFile[], TarFile>;
