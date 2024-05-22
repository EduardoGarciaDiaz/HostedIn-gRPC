const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const dotenv = require('dotenv');
const fs = require('fs');
const PROTO_PATH = "./proto/multimedia.proto";
const User = require('./models/User')
const Accommodation = require('./models/Accommodation')
require('./database.js')

dotenv.config();

const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const multimediaProto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();
    server.addService(multimediaProto.MultimediaService.service, {
        downloadProfilePhoto: downloadProfilePhotoImpl,
        uploadProfilePhoto: uploadProfilePhotoImpl,
        uploadAccommodationMultimedia: uploadAccommodationMultimediaImpl,
        downloadAccommodationMultimedia: downloadAccommodationMultimediaImpl
    });


server.bindAsync(`0.0.0.0:${process.env.SERVER_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Servidor gRPC en ejecución en el puerto ${process.env.SERVER_PORT}`);
});


async function uploadProfilePhotoImpl(call) {
    let profilePhotoBuffer = Buffer.alloc(0);
    let userId;
    call.on('data', function(uploadMultimediaRequest){

        if (!userId) {
            userId = uploadMultimediaRequest.modelId;
        }

        profilePhotoBuffer = Buffer.concat([profilePhotoBuffer, uploadMultimediaRequest.data]);
    });
    
    call.on('end', async function () {
        console.log('Upload complete. Saving photo...');
        try {
            const user = await User.findOneAndUpdate(
                { _id: userId },
                { $set: { profilePhoto: profilePhotoBuffer } },
                { new: true }
            );

            if (!user) {
                console.error('User not found');
                return;
            }

            call.write({ description: 'Upload successful. Profile photo updated' });
            call.end();
        } catch (err) {
            console.error(err);
            call.write({ description: 'Error uploading photo' });
            call.end();
        }
    });
}

async function downloadProfilePhotoImpl(call) {
    const id = call.request.userId;

    try {
        const user = await User.findById(id);

        if (!user) {
            console.error('User not found');
            call.end();
            return;
        }

        const data = user.profilePhoto;

        if (!data) {
            console.error('Profile photo data not found');
            call.end();
            return;
        }

        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

        for (let i = 0; i < buffer.length; i += 1024) {
            const end = Math.min(i + 1024, buffer.length);
            const chunk = buffer.slice(i, end);
            call.write({ data: chunk });
        }

        call.end();
    } catch (err) {
        console.error(err);
        call.end();
    }
}

async function uploadAccommodationMultimediaImpl(call) {
    let accommodationMultimediaBuffer = Buffer.alloc(0);
    let accommodationId;
    
    console.log("ENTRÓ")

    call.on('data', function(uploadMultimediaRequest){

        if (!accommodationId) {
            accommodationId = uploadMultimediaRequest.modelId;
        }

        accommodationMultimediaBuffer = Buffer.concat([accommodationMultimediaBuffer, uploadMultimediaRequest.data]);
    });

    call.on('end', async function () {
        console.log('Upload complete. Saving accommodation multimedia...');
        try {
            const updatedAccommodation = await Accommodation.findOneAndUpdate(
                { _id: accommodationId },
                { $push: { multimedias: accommodationMultimediaBuffer } },
                { new: true }

            );
    
            if (!updatedAccommodation) {
                console.error('User not found');
                return;
            }

            call.write({ description: 'Upload successful. Accommodation multimedia updated' });
            call.end();
        } catch (err) {
            console.error(err);
            call.write({ description: 'Error uploading multimedia' });
            call.end();
        }
    });
}

async function downloadAccommodationMultimediaImpl(call) {
    try {
        const accommodation = await Accommodation.findById(call.request.modelId);
        let index = call.request.multimediaIndex;

        if (!accommodation) {
            console.error('Accommodation not found');
            call.end();
            return;
        }

        console.log(accommodation.index)
        if (index === undefined) {
            index = 0;
            //console.error('Multimedia index not found');
            //call.end();
            //return;
        }

        const data = accommodation.multimedias;

        if (!data) {
            console.error('Multimedia data not found');
            call.end();
            return;
        }

        console.log('Downloading multimedia...');

        const buffer = Buffer.isBuffer(data[index]) ? data[index] : Buffer.from(data[index]);

        for (let i = 0; i < buffer.length; i += 1024) {
            const end = Math.min(i + 1024, buffer.length);
            const chunk = buffer.slice(i, end);
            call.write({ data: chunk });
        }

        call.end(); 
        
    } catch (err) {
        console.error(err);
        call.end();
    }
    
}
