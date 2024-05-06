interface SkeletonProps {
    imageName: string;
}

function Skeleton({ imageName }: SkeletonProps) {
    return (
        <div className="relative rounded-lg bg-neutral min-h-[199.00px] max-w-[300px] mb-4">
            <span className="loading loading-spinner absolute loading-lg  top-20 right-[8.5rem] "></span>
            <p className="absolute rounded-b-lg bottom-0 pl-2 p-2 w-full text-lg text-justify truncate text-ellipsis overflow-hidden bg-black bg-opacity-75 font-medium">
                {imageName}
            </p>
        </div>
    );
}

export default Skeleton;
