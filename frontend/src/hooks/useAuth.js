import { useQuery } from "@chakra-ui/react"
import { getUser } from "../lib/api";

export const AUTH = "auth";


const useAuth = (opts = {}) => {
    const {
        data: user,
        ...rest
    } = useQuery({
        queryKey: [AUTH],
        queryFn: getUser,
        staleTime: Infinity,
        ...opts
    });
    return {
        user, ...rest
    }
}

export default useAuth;