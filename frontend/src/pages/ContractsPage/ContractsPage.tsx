import { useContractsLogic } from "../../features/contracts/hooks/useContractsLogic";
import { ContractsHeader } from "../../components/contractorder/ContractsHeader";
import { ContractsFilter } from "../../components/contractorder/ContractsFilter";
import { EmptyContractsState } from "../../components/contractorder/EmptyContractsState";
import { ContractCard } from "../../components/contractorder/ContractCard";

export function ContractsPage() {
  const {
    user,
    navigate,
    orders,
    loading,
    activeFilter,
    setActiveFilter,
    filteredContracts,
    handleSignContract,
    handleUpdateOrderStatus,
  } = useContractsLogic();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2F7E47]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <ContractsHeader />

        <ContractsFilter
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />

        {filteredContracts.length === 0 ? (
          <EmptyContractsState activeFilter={activeFilter} />
        ) : (
          <div className="flex flex-col gap-5">
            {filteredContracts.map((contract) => {
              const relatedOrder = orders.find((o) =>
                typeof o.contractId === "string"
                  ? o.contractId === contract._id
                  : (o.contractId as any)?._id === contract._id,
              );

              return (
                <ContractCard
                  key={contract._id}
                  contract={contract}
                  order={relatedOrder}
                  user={user}
                  navigate={navigate}
                  handleSignContract={handleSignContract}
                  handleUpdateOrderStatus={handleUpdateOrderStatus}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractsPage;
