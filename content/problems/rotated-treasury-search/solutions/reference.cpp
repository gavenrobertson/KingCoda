class Solution {
public:
    int findVault(vector<int>& vaults, int target) {
        int lo = 0, hi = (int)vaults.size() - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (vaults[mid] == target) return mid;
            if (vaults[lo] <= vaults[mid]) {
                if (vaults[lo] <= target && target < vaults[mid]) hi = mid - 1;
                else lo = mid + 1;
            } else {
                if (vaults[mid] < target && target <= vaults[hi]) lo = mid + 1;
                else hi = mid - 1;
            }
        }
        return -1;
    }
};
