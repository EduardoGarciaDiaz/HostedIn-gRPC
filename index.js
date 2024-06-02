const dotenv = require('dotenv');
dotenv.config(); 

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require('fs');
const PROTO_PATH = "./proto/multimedia.proto";
const User = require('./models/User')
const Accommodation = require('./models/Accommodation')
const Booking = require('./models/Booking')
const BookingStatus = require('./models/BookingStatus')
const {
    getTopBookedAcommodations,
    getTopRatedAccommodations,
    getTopBookedAccommodationsForHost,
    getHostEarningsByMonth
} = require('./services/statictics.service.js');
const authorize = require('./middleware/authorize.interceptor.js')


require('./database.js')


const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const multimediaProto = grpc.loadPackageDefinition(packageDefinition);

const server = new grpc.Server();
    server.addService(multimediaProto.MultimediaService.service, {
        downloadProfilePhoto: downloadProfilePhotoImpl,
        uploadProfilePhoto: uploadProfilePhotoImpl,
        uploadAccommodationMultimedia: uploadAccommodationMultimediaImpl,
        downloadAccommodationMultimedia: downloadAccommodationMultimediaImpl,
        updateAccommodationMultimedia: updateAccommodationMultimediaImpl 
    });
    server.addService(multimediaProto.StaticticsService.service, {
        GetMostBookedAccommodations: async (call, callback) => {
            await authorize('Guest')(call, callback, async () => {
                await GetMostBookedAccommodations(call, callback);
            });
        },
        GetMostBookedAccommodationsOfHost: async (call, callback) => {
            await authorize('Host')(call, callback, async () => {
                await GetMostBookedAccommodationsOfHost(call, callback);
            });
        },
        GetEarnings: async (call, callback) => {
            await authorize('Host')(call, callback, async () => {
                await GetEarnings(call, callback);
            });
        },
        GetBestRatedAccommodations: async (call, callback) => {
            await authorize('Guest')(call, callback, async () => {
                await GetBestRatedAccommodations(call, callback);
            });
        }
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

    console.log(id)
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

        console.log('---------------------------------')
        console.log(`Descargando multimedia para ${accommodation.title}`)
        if (!accommodation) {
            console.error('Accommodation not found');
            call.end();
            return;
        }

        if (index === undefined) {
            index = 0;
            //console.error('Multimedia index not found');
            //call.end();
            //return;
        }

        const data = accommodation.multimedias;

        if (!data) {
            call.end();
            return;
        }

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


async function updateAccommodationMultimediaImpl(call) {
    try {
        let accommodationMultimediaBuffer = Buffer.alloc(0);
        let accommodationId;
        let multimediaIndex;
        

        call.on('data', function(updateMultimediaRequest){

            if (!accommodationId) {
                accommodationId = updateMultimediaRequest.modelId;
            }
            if(!multimediaIndex) {
                multimediaIndex = updateMultimediaRequest.multimediaId;
            }

            accommodationMultimediaBuffer = Buffer.concat([accommodationMultimediaBuffer, updateMultimediaRequest.data]);
        });


        call.on('end', async function () {

            const hasBookings = await Booking.findOne({accommodation : accommodationId, bookingStatus : BookingStatus.CURRENT})
            if (hasBookings) {
                call.write({ description:  "El alojamiento todavia tiene reservaciones pendientes." });
                call.end();
                return;
            }

            console.log(hasBookings);
        

                if (multimediaIndex === undefined) {
                    multimediaIndex = 0;
                
                }

                const updateField = `multimedias.${multimediaIndex}`;
                const update = {};
                update[updateField] = accommodationMultimediaBuffer;

                const updatedAccommodation = await Accommodation.findOneAndUpdate(
                    { _id: accommodationId },
                    { $set: update },
                    { new: true }
                );

                if (!updatedAccommodation) {
                    console.error('Accommodation not found');
                    return;
                }

                call.write({ description: 'Upload successful. Accommodation multimedia updated' });
                call.end();            
        });
    } catch (err) {
        console.error(err);
        call.write({ description: 'Error uploading multimedia' });
        call.end();
    }
}

async function GetMostBookedAccommodations(call, callback) {
    try {
        const results = await getTopBookedAcommodations();
        const response = {
            accommodations: results.map(result => ({
                title: result.title,
                bookingsNumber: result.reservationCount
            }))
        };
        callback(null, response);
    } catch (error) {
        callback(error);
    }
}

async function GetBestRatedAccommodations(call, callback) {
    try {
        const results = await getTopRatedAccommodations();
        const response = {
            accommodations: results.map(result => ({
                name: result.title,
                rate: result.averageRating
            }))
        };
        callback(null, response);
    } catch (error) {
        callback(error);
    }
}

async function GetEarnings(call, callback) {
    try {
        const results = await getHostEarningsByMonth(call.request.idHost);
        const response = {
            earnings: results.map(result => ({
                month: result.month,
                earning: result.earnings
            }))
        };
        callback(null, response);
    } catch (error) {
        callback(error);
    }
}

async function GetMostBookedAccommodationsOfHost(call, callback) {
    try {
        console.log('Im here')
        const results = await getTopBookedAccommodationsForHost(call.request.idHost);
        const response = {
            accommodations: results.map(result => ({
                title: result.title,
                bookingsNumber: result.reservationCount
            }))
        };
        console.log(response)
        callback(null, response);
    } catch (error) {
        callback(error);
    }
}