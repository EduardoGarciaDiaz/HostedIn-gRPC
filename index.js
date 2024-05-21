const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const dotenv = require('dotenv');
const fs = require('fs');
const PROTO_PATH = "./proto/multimedia.proto";
const User = require('./models/User.js')
require('./database.js')

dotenv.config();

const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const multimediaProto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();

    server.addService(multimediaProto.MultimediaService.service, {
        downloadProfilePhoto: downloadProfilePhotoImpl,
        uploadPhotoProfile: uploadPhotoProfileImpl
    });


server.bindAsync(`0.0.0.0:${process.env.SERVER_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Servidor gRPC en ejecución en el puerto ${process.env.SERVER_PORT}`);
});


async function uploadPhotoProfileImpl(call) {
    let profilePhotoBuffer = Buffer.alloc(0);
    let userId;

    call.on('data', function(uploadProfilePhotoRequest){

        if (!userId) {
            userId = uploadProfilePhotoRequest.userId;
        }

        profilePhotoBuffer = Buffer.concat([profilePhotoBuffer, uploadProfilePhotoRequest.data]);
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