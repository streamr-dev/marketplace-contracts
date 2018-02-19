import React, { Component } from 'react'
import List from 'react-list'

class ProductList extends Component {
    state = {
        products: []
    }

    // get products from contract
    componentWillMount() {        
        if (!this.props.web3) {
            console.error("Web3 not loaded!")
            return
        }
        this.setState({
            products: [{name: "test1"}, {name: "test2"}]
        })
    }

    renderItem(i, key) {
        return (
            <div key={key} class="ProductRow">{this.state.accounts[i].name}</div>
        )
    }

    render() {
        return (
            <ReactList
                itemRenderer={this.renderItem.bind(this)}
                length={this.state.products.length}
                type="uniform"
            />
        )
    }
}