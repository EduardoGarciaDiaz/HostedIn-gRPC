const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
const ClaimTypes = require('../config/claimtypes');
const grpc = require('@grpc/grpc-js')

const authorize = (requiredRoles) => {
    return async (call, callback, next) => {
        try {
            const authHeader = call.request.token;
            if (!authHeader) {
                return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Unauthorized' });
            }
            const token = authHeader.split(' ')[1];
            const decodedToken = jwt.verify(token, jwtSecret);
            const userRoles = decodedToken[ClaimTypes.Role];
            const requiredRolesArray = requiredRoles.split(',');

            const hasRequiredRole = requiredRolesArray.some(role => userRoles.includes(role));
            if (!hasRequiredRole) {
                return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Forbidden' });
            }

            next();
        } catch (error) {
            console.log(error)
            return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Unauthorized' });
        }
    };
};

module.exports = authorize;
