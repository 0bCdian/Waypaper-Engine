interface SkeletonProps {
    imageName: string;
}

function Skeleton({ imageName }: SkeletonProps) {
    return (
        <div className="relative mb-4 min-h-[199.00px] max-w-[300px] rounded-lg bg-neutral">
            <span className="loading loading-spinner loading-lg absolute right-[8.5rem] top-20"></span>
            <p className="absolute bottom-0 w-full overflow-hidden truncate text-ellipsis rounded-b-lg bg-black bg-opacity-75 p-2 pl-2 text-justify text-lg font-medium">
                {imageName}
            </p>
        </div>
    );
}

export default Skeleton;
