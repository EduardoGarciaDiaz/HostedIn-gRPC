const mongoose = require('mongoose');
const Booking = require('../models/Booking')
const Accommodation = require('../models/Accommodation')
const Review = require('../models/Review')

const getTopBookedAcommodations = async () => {
    const currentYear = new Date().getFullYear();

    try {

        
        const results = await Booking.aggregate([
            {
                $match: {
                    beginningDate: {
                        $gte: new Date(`${currentYear}-01-01`),
                        $lt: new Date(`${currentYear + 1}-01-01`)
                    }
                }
            },
            {
                $group: {
                    _id: "$accommodation",
                    reservationCount: { $sum: 1 }
                }
            },
            {
                $sort: { reservationCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'accomodations',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'accommodation'
                }
            },
            {
                $unwind: "$accommodation"
            },
            {
                $project: {
                    _id: 0,
                    title: "$accommodation.title",
                    reservationCount: 1
                }
            }
        ]).exec();

        return results;
    } catch (err) {
        console.error(err);
        throw err;
    }
}

const getTopRatedAccommodations = async () => {
    try {
        const results = await Review.aggregate([
            {
                $group: {
                    _id: "$accommodation",
                    averageRating: { $avg: "$rating" }
                }
            },
            {
                $sort: { averageRating: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'accomodations',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'accommodation'
                }
            },
            {
                $unwind: "$accommodation"
            },
            {
                $project: {
                    _id: 0,
                    title: "$accommodation.title",
                    averageRating: 1
                }
            }
        ]).exec();

        console.log(results);
        return results;
    } catch (err) {
        console.error(err);
        throw err;
    }
}

const getTopBookedAccommodationsForHost = async (hostId) => {
    try {
        const results = await Booking.aggregate([
            {
                $match: {
                    hostUser: mongoose.Types.ObjectId(hostId)
                }
            },
            {
                $group: {
                    _id: "$accommodation",
                    reservationCount: { $sum: 1 }
                }
            },
            {
                $sort: { reservationCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'accomodations',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'accommodation'
                }
            },
            {
                $unwind: "$accommodation"
            },
            {
                $project: {
                    _id: 0,
                    title: "$accommodation.title",
                    reservationCount: 1
                }
            }
        ]).exec();

        console.log(results);
        return results;
    } catch (err) {
        console.error(err);
        throw err;
    }
}

const getHostEarningsByMonth = async (hostId) => {
    try {
        const results = await Booking.aggregate([
            {
                $match: {
                    hostUser: mongoose.Types.ObjectId(hostId),
                    bookingStatus: 'Overdue'
                }
            },
            {
                $addFields: {
                    totalNights: { $subtract: [ { $divide: [ { $subtract: [ "$endingDate", "$beginningDate" ] }, 1000 * 60 * 60 * 24 ] }, 1 ] }
                }
            },
            {
                $addFields: {
                    earnings: { $multiply: [ "$totalNights", "$nightPrice" ] }
                }
            },
            {
                $group: {
                    _id: { $month: "$beginningDate" },
                    earnings: { $sum: "$earnings" }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: "$_id",
                    earnings: 1
                }
            },
            {
                $sort: { month: 1 }
            }
        ]).exec();

        console.log(results);
        return results;
    } catch (err) {
        console.error(err);
        throw err;
    }
}


module.exports = {
    getTopBookedAcommodations,
    getTopRatedAccommodations,
    getTopBookedAccommodationsForHost,
    getHostEarningsByMonth
}